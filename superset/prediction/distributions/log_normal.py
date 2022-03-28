import math
from functools import partial
from typing import Dict, Optional, Tuple, List

# Third-party imports
import numpy as np

# First-party imports
from gluonts.model.common import Tensor
from gluonts.support.util import erf, erfinv
from gluonts.core.component import validated

# Relative imports
from gluonts.distribution.distribution import \
    Distribution, _sample_multiple, getF, softplus
from gluonts.distribution.gaussian import Gaussian
from gluonts.distribution.distribution_output import DistributionOutput

class LogNormal(Gaussian):
    r"""
    Gaussian distribution.
    Parameters
    ----------
    mu
        Tensor containing the means, of shape `(*batch_shape, *event_shape)`.
    std
        Tensor containing the standard deviations, of shape
        `(*batch_shape, *event_shape)`.
    F
    """

    def log_prob(self, x: Tensor) -> Tensor:
        return self.F.exp(super().log_prob(x))

    def cdf(self, x):
        F = self.F
        u = F.broadcast_div(
            F.broadcast_minus(F.log(x), self.mu), self.sigma * math.sqrt(2.0)
        )
        return (erf(F, u) + 1.0) / 2.0

    def sample(
        self, num_samples: Optional[int] = None, dtype=np.float32
    ) -> Tensor:
        normal_samples = _sample_multiple(
            partial(self.F.sample_normal, dtype=dtype),
            mu=self.mu,
            sigma=self.sigma,
            num_samples=num_samples,
        )
        return self.F.exp(normal_samples)

    def sample_rep(
        self, num_samples: Optional[int] = None, dtype=np.float32
    ) -> Tensor:
        return self.F.exp(super().sample_rep(num_samples, dtype))

    def quantile(self, level: Tensor) -> Tensor:
        F = self.F
        # we consider level to be an independent axis and so expand it
        # to shape (num_levels, 1, 1, ...)
        for _ in range(self.all_dim):
            level = level.expand_dims(axis=-1)

        return F.exp(super().quantile(level))

class LogNormalOutput(DistributionOutput):
    args_dim: Dict[str, int] = {"mu": 1, "sigma": 1}
    distr_cls: type = LogNormal

    @classmethod
    def domain_map(cls, F, mu, sigma):
        r"""
        Maps raw tensors to valid arguments for constructing a Gaussian
        distribution.
        Parameters
        ----------
        F
        mu
            Tensor of shape `(*batch_shape, 1)`
        sigma
            Tensor of shape `(*batch_shape, 1)`
        Returns
        -------
        Tuple[Tensor, Tensor]
            Two squeezed tensors, of shape `(*batch_shape)`: the first has the
            same entries as `mu` and the second has entries mapped to the
            positive orthant.
        """
        sigma = softplus(F, sigma)
        return mu.squeeze(axis=-1), sigma.squeeze(axis=-1)

    @property
    def event_shape(self) -> Tuple:
        return ()
