FROM python:3.6

WORKDIR /usr/src/app

# Copy the requirements.txt and install the dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the package code and its scripts
COPY . .

CMD ["python", "application.py"]