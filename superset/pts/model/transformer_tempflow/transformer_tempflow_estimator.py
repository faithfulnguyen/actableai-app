from typing import List, Optional

import torch

from ... import Trainer
from ...dataset import FieldName
from ...feature import (
    TimeFeature,
    fourier_time_features_from_frequency_str,
    get_fourier_lags_for_frequency,
)
from ...model import PTSEstimator, PTSPredictor, copy_parameters
from ...transform import (
    Transformation,
    Chain,
    InstanceSplitter,
    ExpectedNumInstanceSampler,
    RenameFields,
    AsNumpyArray,
    ExpandDimArray,
    AddObservedValuesIndicator,
    AddTimeFeatures,
    VstackFeatures,
    SetFieldIfNotPresent,
    TargetDimIndicator,
)
from .transformer_tempflow_network import TransformerTempFlowTrainingNetwork, TransformerTempFlowPredictionNetwork


class TransformerTempFlowEstimator(PTSEstimator):
    def __init__(
        self,
        device: torch.device,
        freq: str,
        prediction_target_length: int,
        target_dim: int,
        train_target_length: int = 1,
        trainer: Trainer = Trainer(),
        context_length: Optional[int] = None,
        d_model: int = 32,
        dim_feedforward_scale: int = 4,
        act_type: str = "gelu",
        num_heads: int = 8,
        num_encoder_layers: int = 3,
        num_decoder_layers: int = 3,
        num_parallel_samples: int = 100,
        dropout_rate: float = 0.1,
        cardinality: List[int] = [1],
        embedding_dimension: int = 5,
        flow_type="RealNVP",
        n_blocks=3,
        hidden_size=100,
        n_hidden=2,
        conditioning_length: int = 200,
        dequantize: bool = False,
        scaling: bool = True,
        pick_incomplete: bool = False,
        lags_seq: Optional[List[int]] = None,
        time_features: Optional[List[TimeFeature]] = None,
        **kwargs,
    ) -> None:
        super().__init__(trainer=trainer, **kwargs)

        self.device = device
        self.freq = freq
        self.context_length = (
            context_length if context_length is not None else prediction_target_length
        )

        self.prediction_target_length = prediction_target_length
        self.train_target_length = train_target_length
        self.target_dim = target_dim

        self.d_model = d_model
        self.num_heads = num_heads
        self.act_type = act_type
        self.dim_feedforward_scale = dim_feedforward_scale
        self.num_encoder_layers = num_encoder_layers
        self.num_decoder_layers = num_decoder_layers

        self.num_parallel_samples = num_parallel_samples
        self.dropout_rate = dropout_rate
        self.cardinality = cardinality
        self.embedding_dimension = embedding_dimension

        self.flow_type = flow_type
        self.n_blocks = n_blocks
        self.hidden_size = hidden_size
        self.n_hidden = n_hidden
        self.conditioning_length = conditioning_length
        self.dequantize = dequantize

        self.lags_seq = (
            lags_seq
            if lags_seq is not None
            else get_fourier_lags_for_frequency(freq_str=freq)
        )

        self.time_features = (
            time_features
            if time_features is not None
            else fourier_time_features_from_frequency_str(self.freq)
        )

        self.history_length = self.context_length + max(self.lags_seq)
        self.pick_incomplete = pick_incomplete
        self.scaling = scaling

    def create_transformation(self, is_train=True) -> Transformation:
        return Chain(
            [
                AsNumpyArray(field=FieldName.TARGET, expected_ndim=2,),
                # maps the target to (1, T)
                # if the target data is uni dimensional
                ExpandDimArray(field=FieldName.TARGET, axis=None,),
                AddObservedValuesIndicator(
                    target_field=FieldName.TARGET,
                    output_field=FieldName.OBSERVED_VALUES,
                ),
                AddTimeFeatures(
                    start_field=FieldName.START,
                    target_field=FieldName.TARGET,
                    output_field=FieldName.FEAT_TIME,
                    time_features=self.time_features,
                    pred_length=self.train_target_length if is_train else self.prediction_target_length,
                ),
                VstackFeatures(
                    output_field=FieldName.FEAT_TIME,
                    input_fields=[FieldName.FEAT_TIME],
                ),
                SetFieldIfNotPresent(field=FieldName.FEAT_STATIC_CAT, value=[0]),
                TargetDimIndicator(
                    field_name="target_dimension_indicator",
                    target_field=FieldName.TARGET,
                ),
                AsNumpyArray(field=FieldName.FEAT_STATIC_CAT, expected_ndim=1),
                InstanceSplitter(
                    target_field=FieldName.TARGET,
                    is_pad_field=FieldName.IS_PAD,
                    start_field=FieldName.START,
                    forecast_start_field=FieldName.FORECAST_START,
                    train_sampler=ExpectedNumInstanceSampler(num_instances=1),
                    past_length=self.history_length,
                    future_length=self.train_target_length if is_train else self.prediction_target_length,
                    time_series_fields=[
                        FieldName.FEAT_TIME,
                        FieldName.OBSERVED_VALUES,
                    ],
                    pick_incomplete=self.pick_incomplete,
                ),
                RenameFields(
                    {
                        f"past_{FieldName.TARGET}": f"past_{FieldName.TARGET}_cdf",
                        f"future_{FieldName.TARGET}": f"future_{FieldName.TARGET}_cdf",
                    }
                ),
            ]
        )

    def create_training_network(self, device: torch.device) -> TransformerTempFlowTrainingNetwork:
        return TransformerTempFlowTrainingNetwork(
            device=self.device,
            target_dim=self.target_dim,
            num_heads=self.num_heads,
            act_type=self.act_type,
            d_model=self.d_model,
            dim_feedforward_scale=self.dim_feedforward_scale,
            num_encoder_layers=self.num_encoder_layers,
            num_decoder_layers=self.num_decoder_layers,
            history_length=self.history_length,
            context_length=self.context_length,
            prediction_length=self.train_target_length,
            dropout_rate=self.dropout_rate,
            cardinality=self.cardinality,
            embedding_dimension=self.embedding_dimension,
            lags_seq=self.lags_seq,
            scaling=self.scaling,
            flow_type=self.flow_type,
            n_blocks=self.n_blocks,
            hidden_size=self.hidden_size,
            n_hidden=self.n_hidden,
            conditioning_length=self.conditioning_length,
            dequantize=self.dequantize,
        ).to(device)

    def create_predictor(
        self,
        transformation: Transformation,
        trained_network: TransformerTempFlowTrainingNetwork,
        device: torch.device,
    ) -> PTSPredictor:
        prediction_network = TransformerTempFlowPredictionNetwork(
            device=self.device,
            target_dim=self.target_dim,
            num_heads=self.num_heads,
            act_type=self.act_type,
            d_model=self.d_model,
            dim_feedforward_scale=self.dim_feedforward_scale,
            num_encoder_layers=self.num_encoder_layers,
            num_decoder_layers=self.num_decoder_layers,
            history_length=self.history_length,
            context_length=self.context_length,
            prediction_length=self.prediction_target_length,
            dropout_rate=self.dropout_rate,
            cardinality=self.cardinality,
            embedding_dimension=self.embedding_dimension,
            lags_seq=self.lags_seq,
            scaling=self.scaling,
            flow_type=self.flow_type,
            n_blocks=self.n_blocks,
            hidden_size=self.hidden_size,
            n_hidden=self.n_hidden,
            conditioning_length=self.conditioning_length,
            dequantize=self.dequantize,
            num_parallel_samples=self.num_parallel_samples,
            input_size=trained_network.input_size,
        ).to(device)

        # Create a new target mask with predictor's prediction length. This allows decoupling of prediction_length
        # for trained_network and prediction_network.
        trained_network.register_buffer(
            "tgt_mask",
            trained_network.transformer.generate_square_subsequent_mask(self.prediction_target_length),
        )

        copy_parameters(trained_network, prediction_network)

        return PTSPredictor(
            input_transform=transformation,
            prediction_net=prediction_network,
            batch_size=self.trainer.batch_size,
            freq=self.freq,
            prediction_length=self.prediction_target_length,
            device=device,
            output_transform=None,
        )
