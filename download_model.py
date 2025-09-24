# download_model.py
from sentence_transformers import SentenceTransformer
import os

# --- Configuration ---
MODEL_NAME = "all-MiniLM-L6-v2"
DOWNLOAD_PATH = "iira-backend/ml_models/all-MiniLM-L6-v2" # The path where the model will be saved

# --- Main Script ---
print(f"Downloading model '{MODEL_NAME}'...")

# Create the target directory if it doesn't exist
if not os.path.exists(DOWNLOAD_PATH):
    os.makedirs(DOWNLOAD_PATH)

# Download and save the model to the specified path
model = SentenceTransformer(MODEL_NAME)
model.save(DOWNLOAD_PATH)

print(f"\n✅ Model downloaded successfully and saved to: {DOWNLOAD_PATH}")
print("You can now copy this directory into your Docker image.")