import pandas as pd
import numpy as np

# CSV is formatted as:
# ax, ay, az, rx, ry, rz, label
# where label is 0 if a jumping jack was not present in this frame and 1 if it was

df = pd.read_csv('jumping_jacks_and_noise_combined.csv')

SAMPLES_PER_CHUNK = 20
OVERLAP = 5

# Samples are read every 50ms. We use a window size of SAMPLES_PER_CHUNK.
# Split the dataframe into chunks, overlapping by OVERLAP samples.

chunks = []
for i in range(0, len(df), OVERLAP):
    chunk = df[i:i+SAMPLES_PER_CHUNK]
    if len(chunk) == SAMPLES_PER_CHUNK:
        chunks.append(chunk)

# We want to label the chunk as a jumping jack if at least half the samples in the chunk are labeled as such.
# Otherwise, label it as noise.
for idx, chunk in enumerate(chunks):
    if chunk['label'].sum() > SAMPLES_PER_CHUNK // 2:
        chunks[idx] = chunk.assign(label= 1)
    else:
        chunks[idx] = chunk.assign(label= 0)

# Reshape chunk from (SAMPLES_PER_CHUNK, 7), where the last column is the label,
# into (SAMPLES_PER_CHUNK * 6) where the last column is the label.
# Since the entire chunk is a single sample, we can just concatenate the rows excluding the last column.

reshaped_chunks = []
labels = []
for chunk in chunks:
    label = chunk['label'].iloc[0]
    chunk = chunk.values
    chunk = chunk[:, :-1].reshape(-1)
    reshaped_chunks.append(chunk)
    labels.append(label)

X = np.array(reshaped_chunks, dtype=np.float32)
y = np.array(labels, dtype=np.int32)

# Split into training and test sets
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train a random forest classifier
from sklearn.ensemble import RandomForestClassifier
clf = RandomForestClassifier(n_estimators=100, max_depth=3, random_state=0)
clf.fit(X_train, y_train)

print(clf.score(X_test, y_test))

from sklearn.metrics import ConfusionMatrixDisplay
import matplotlib.pyplot as plt 

# Show confusion matrix
y_pred = clf.predict(X_test)
cm = ConfusionMatrixDisplay.from_predictions(y_test, y_pred)
cm.plot()
plt.show()

import micromlgen as mlgen

# Generate C code for the model

c = mlgen.port(clf)

with open('jumping_jack_detector.', 'w') as f:
    f.write(c)
