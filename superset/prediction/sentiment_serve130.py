import os
import ray
from ray import serve

from actableai.sentiment.SpanABSA import AAISentimentExtractor


if __name__ == "__main__":
    ray.init(os.getenv("RAY_CLIENT"), namespace="aai")
    serve.start(detached=True)

    AAISentimentExtractor.deploy(
        num_replicas=int(os.getenv("N_REPLICAS_SENTIMENT", 1)),
        ray_options={
            "num_cpus": float(os.environ["N_CPU_SENTIMENT"]),
            "num_gpus": float(os.environ["N_GPU_SENTIMENT"])
        },
        device=os.environ["SENTIMENT_DEVICE"],
        BERT_DIR=os.environ["BERT_DIR"],
        EXTRACT_MODEL_DIR=os.environ["EXTRACT_MODEL_DIR"],
        CLASSIFICATION_MODEL_DIR=os.environ["CLASSIFICATION_MODEL_DIR"]
    )
