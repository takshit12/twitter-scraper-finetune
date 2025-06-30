# Degen Scraper

Pipeline for generating AI character files and training datasets by scraping public figures' online presence across Twitter and blogs.

> ⚠️ **IMPORTANT**: Create a new Twitter account for this tool. DO NOT use your main account as it may trigger Twitter's automation detection and result in account restrictions.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the `.env.example` into a `.env` file:
   ```properties
   # (Required) Twitter Authentication
   TWITTER_USERNAME=     # your twitter username
   TWITTER_PASSWORD=     # your twitter password

   # (Optional) Blog Configuration
   BLOG_URLS_FILE=      # path to file containing blog URLs

   # (Optional) Scraping Configuration
   MAX_TWEETS=          # max tweets to scrape
   MAX_RETRIES=         # max retries for scraping
   RETRY_DELAY=         # delay between retries
   MIN_DELAY=           # minimum delay between requests
   MAX_DELAY=           # maximum delay between requests
   ```

## Usage

### Twitter Collection 
```bash
npm run twitter -- username
```
Example: `npm run twitter -- pmarca`

### Collection with date range
```bash
npm run twitter -- username --start-date 2025-01-01 --end-date 2025-01-31
```    

### Merge Characters
```bash
npm run merge-characters -- new-character-name character1 character2
```
Example: `npm run merge-characters -- cobiedart cobie-2025-01-29 satsdart-2025-01-29`

### Blog Collection
```bash
npm run blog
```

### Generate Character
```bash
npm run character -- username date
```
Example: `npm run character -- pmarca 2024-11-29`

### Finetune

#### Option 1: Together AI (Original)
```bash
npm run finetune
```

#### Option 2: Google Vertex AI
First, convert your data to Vertex AI format:
```bash
npm run convert-vertex-ai
```

This will create `finetuning_vertex_ai.jsonl` files in the same directories as your original `finetuning.jsonl` files, formatted for Google Vertex AI.

Then follow the [Vertex AI Fine-tuning Guide](#vertex-ai-fine-tuning-guide) below.

### Finetune (with test)
```bash
npm run finetune:test
```

### Generate Virtuals Character Card
https://whitepaper.virtuals.io/developer-documents/agent-contribution/contribute-to-cognitive-core#character-card-and-goal-samples

Run this after Twitter Collection step 
```bash
npm run generate-virtuals -- username date 
```

Example: `npm run generate-virtuals -- pmarca 2024-11-29`
Example without date: `npm run generate-virtuals -- pmarca`

The generated character file will be in the `pipeline/[username]/[date]/character/character.json` directory.
The generated tweet dataset file will be in `pipeline/[username]/[date]/raw/tweets.json`.

### Generate Merged Character
```bash
npm run generate-merged-virtuals -- username date
```
Example: `npm run generate-merged-virtuals -- pmarca 2024-11-29`

The generated merged character file will be in `pipeline/[username]/[date]/character/merged_character.json` directory.

## Vertex AI Fine-tuning Guide

### Prerequisites

1. **Google Cloud Setup:**
   - Google Cloud Platform (GCP) account
   - Project with billing enabled
   - Vertex AI API enabled
   - Cloud Storage bucket for datasets

2. **Authentication:**
   ```bash
   # Install Google Cloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Authenticate
   gcloud auth login
   gcloud auth application-default login
   
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable Required APIs:**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   gcloud services enable storage.googleapis.com
   ```

### Data Preparation

1. **Convert your data:**
   ```bash
   npm run convert-vertex-ai
   ```

2. **Upload to Cloud Storage:**
   ```bash
   # Create a bucket (replace with your bucket name)
   gsutil mb gs://your-finetuning-bucket
   
   # Upload your converted dataset
   gsutil cp pipeline/_takshit/2025-06-30/processed/finetuning_vertex_ai.jsonl gs://your-finetuning-bucket/training/
   ```

### Fine-tuning Methods

#### Method 1: Google Cloud Console

1. Go to [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/studio)
2. Click **Create tuned model**
3. Configure:
   - **Tuned model name**: `takshit-character-model`
   - **Base model**: `gemini-2.5-flash`
   - **Region**: `us-central1`
4. Upload your `finetuning_vertex_ai.jsonl` file
5. Click **Start Tuning**

#### Method 2: Python SDK

```python
import vertexai
from vertexai.tuning import sft

# Initialize Vertex AI
vertexai.init(project="YOUR_PROJECT_ID", location="us-central1")

# Start fine-tuning job
sft_tuning_job = sft.train(
    source_model="gemini-2.5-flash",
    train_dataset="gs://your-finetuning-bucket/training/finetuning_vertex_ai.jsonl",
    tuned_model_display_name="takshit-character-model",
    epochs=3,
    adapter_size=4,
    learning_rate_multiplier=1.0
)

# Wait for completion
print(f"Tuning job: {sft_tuning_job.resource_name}")
print(f"Model endpoint: {sft_tuning_job.tuned_model_endpoint_name}")
```

#### Method 3: REST API

```bash
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1/tuningJobs" \
  -d '{
    "baseModel": "gemini-2.5-flash",
    "supervisedTuningSpec": {
      "trainingDatasetUri": "gs://your-finetuning-bucket/training/finetuning_vertex_ai.jsonl",
      "hyperParameters": {
        "epochCount": "3",
        "adapterSize": "4",
        "learningRateMultiplier": "1.0"
      }
    },
    "tunedModelDisplayName": "takshit-character-model"
  }'
```

### Using Your Fine-tuned Model

#### Install the Vertex AI SDK
```bash
npm install @google/genai
```

#### Generate Content
```javascript
import { GoogleGenAI } from '@google/genai';

// Initialize Vertex with your Cloud project and location
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'YOUR_PROJECT_ID',
  location: 'us-central1'
});

// Use your fine-tuned model endpoint
const model = 'projects/YOUR_PROJECT_ID/locations/us-central1/endpoints/YOUR_ENDPOINT_ID';

const generationConfig = {
  maxOutputTokens: 1000,
  temperature: 0.9,
  topP: 0.95,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'OFF',
    }
  ],
};

async function generateContent() {
  const req = {
    model: model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Generate a tweet in the style of @takshit about AI development'
          }
        ]
      }
    ],
    config: generationConfig,
  };

  const streamingResp = await ai.models.generateContentStream(req);

  for await (const chunk of streamingResp) {
    if (chunk.text) {
      process.stdout.write(chunk.text);
    }
  }
}

generateContent();
```

### Key Differences: Together AI vs Vertex AI

| Feature | Together AI | Vertex AI |
|---------|-------------|-----------|
| **Data Format** | `{"text": "content"}` | Conversational format with user/model roles |
| **Cost** | Pay per token | Pay per training token + inference |
| **Models** | Multiple open-source models | Gemini 2.5 Flash, 2.0 Flash |
| **Setup** | API key only | GCP project + authentication |
| **Integration** | Simple API calls | Google Cloud ecosystem |
| **Monitoring** | Basic | Advanced metrics in Vertex AI Studio |

### Best Practices

1. **Data Quality**: Start with 100-500 high-quality examples
2. **Validation Split**: Use 10-20% of data for validation
3. **Hyperparameters**: Start with default values, then tune
4. **Cost Management**: Monitor training tokens (cost = tokens × epochs)
5. **Testing**: Always test the fine-tuned model before production use

### Troubleshooting

- **Authentication Issues**: Run `gcloud auth application-default login`
- **Quota Limits**: Check Vertex AI quotas in GCP Console
- **Data Format Errors**: Ensure JSONL follows exact Vertex AI format
- **Upload Failures**: Verify Cloud Storage bucket permissions