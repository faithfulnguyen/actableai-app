FROM nvidia/cuda:11.0-cudnn8-devel-ubuntu18.04 AS nvidia

FROM python:3.7.7

ENV CUDA_MAJOR_VERSION=11
ENV CUDA_MINOR_VERSION=0
ENV CUDA_VERSION=$CUDA_MAJOR_VERSION.$CUDA_MINOR_VERSION
ENV PATH=/usr/local/nvidia/bin:/usr/local/cuda/bin:${PATH}
# The stub is useful to us both for built-time linking and run-time linking, on CPU-only systems.
# When intended to be used with actual GPUs, make sure to (besides providing access to the host
# CUDA user libraries, either manually or through the use of nvidia-docker) exclude them. One
# convenient way to do so is to obscure its contents by a bind mount:
#   docker run .... -v /non-existing-directory:/usr/local/cuda/lib64/stubs:ro ...
ENV LD_LIBRARY_PATH="/usr/local/nvidia/lib:/usr/local/nvidia/lib64"
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
ENV NVIDIA_REQUIRE_CUDA="cuda>=$CUDA_MAJOR_VERSION.$CUDA_MINOR_VERSION"

LABEL com.nvidia.volumes.needed="nvidia_driver"
LABEL com.nvidia.cuda.version="${CUDA_VERSION}"

COPY --from=nvidia /etc/apt/sources.list.d/cuda.list /etc/apt/sources.list.d/
COPY --from=nvidia /etc/apt/sources.list.d/nvidia-ml.list /etc/apt/sources.list.d/
COPY --from=nvidia /etc/apt/trusted.gpg /etc/apt/trusted.gpg.d/cuda.gpg
COPY --from=nvidia /usr/local/cuda /usr/local/cuda

# Install R
RUN apt-get update -y \
    && apt-get install -y build-essential \
    && apt-get install -y r-base  \
    && R -e 'install.packages(c("forecast", "nnfor"), repos="https://cloud.r-project.org")'

RUN apt-get install -y --no-install-recommends \
      unzip \
      cuda-cupti-$CUDA_VERSION \
      cuda-cudart-$CUDA_VERSION \
      cuda-cudart-dev-$CUDA_VERSION \
      cuda-libraries-$CUDA_VERSION \
      cuda-libraries-dev-$CUDA_VERSION \
      cuda-nvml-dev-$CUDA_VERSION \
      cuda-minimal-build-$CUDA_VERSION \
      cuda-command-line-tools-$CUDA_VERSION \
      libcudnn8=8.0.4.30-1+cuda$CUDA_VERSION \
      libcudnn8-dev=8.0.4.30-1+cuda$CUDA_VERSION \
      libnccl2=2.7.8-1+cuda$CUDA_VERSION \
      libnccl-dev=2.7.8-1+cuda$CUDA_VERSION && \
      ln -s /usr/local/cuda-$CUDA_VERSION /usr/local/cuda && \
      ln -s /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1

RUN pip install pip --upgrade

RUN pip install nltk==3.6.2 \
    && pip install torch==1.7.1+cu110 torchvision==0.8.2+cu110 -f https://download.pytorch.org/whl/torch_stable.html \
    && pip install Cython==0.29.24 \
    && python -c "import nltk; nltk.download('punkt')"

WORKDIR /data

COPY ./actableai-lib/third_parties/autogluon ./actableai-lib/third_parties/autogluon

RUN python -c "import nltk; nltk.download('punkt')"

COPY ./requirements-exp.txt ./requirements-exp-gpu.txt ./
RUN cat requirements-exp.txt requirements-exp-gpu.txt | xargs --max-args=1 --max-procs=8 pip install --disable-pip-version-check --no-deps; exit 0

COPY ./actableai-lib ./actableai-lib

RUN pip install --no-deps ./actableai-lib

