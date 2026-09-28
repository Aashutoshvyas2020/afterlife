FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt
ENV MPLCONFIGDIR=/tmp/matplotlib
RUN python -c "import matplotlib.pyplot"
COPY run_seqrecord_plot.py .
COPY http_adapter.py .
EXPOSE 8080
ENTRYPOINT ["python", "/app/http_adapter.py"]
