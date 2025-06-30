import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VertexAIConverter {
  constructor() {
    this.PROJECT_ROOT = path.resolve(__dirname, '..');
  }

  /**
   * Convert Together AI format to Vertex AI format
   * @param {string} inputPath - Path to Together AI format JSONL file
   * @param {string} outputPath - Path for Vertex AI format JSONL file
   * @param {string} username - Username for personalized prompts
   */
  async convertFormat(inputPath, outputPath, username = 'user') {
    try {
      console.log(`Converting ${inputPath} to Vertex AI format...`);
      
      // Read the input file
      const inputData = fs.readFileSync(inputPath, 'utf-8');
      const lines = inputData.trim().split('\n');
      
      const convertedLines = [];
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const originalData = JSON.parse(line);
            
            // Skip if no text content
            if (!originalData.text || originalData.text.trim().length === 0) {
              continue;
            }
            
            // Create Vertex AI format
            const vertexAIFormat = {
              "contents": [
                {
                  "role": "user",
                  "parts": [
                    {
                      "text": `Generate a tweet in the style of @${username}. Keep it authentic to their voice and personality.`
                    }
                  ]
                },
                {
                  "role": "model", 
                  "parts": [
                    {
                      "text": originalData.text.trim()
                    }
                  ]
                }
              ]
            };
            
            convertedLines.push(JSON.stringify(vertexAIFormat));
          } catch (parseError) {
            console.warn(`Skipping invalid JSON line: ${line.substring(0, 100)}...`);
          }
        }
      }
      
      // Write the converted data
      fs.writeFileSync(outputPath, convertedLines.join('\n'), 'utf-8');
      
      console.log(`✅ Successfully converted ${lines.length} entries to ${convertedLines.length} valid Vertex AI format entries`);
      console.log(`📁 Output saved to: ${outputPath}`);
      
      return {
        originalCount: lines.length,
        convertedCount: convertedLines.length,
        outputPath: outputPath
      };
      
    } catch (error) {
      console.error(`❌ Error converting file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find all finetuning.jsonl files in the pipeline directory
   */
  findFineTuningFiles() {
    const pipelineDir = path.join(this.PROJECT_ROOT, 'pipeline');
    const files = [];
    
    function searchDirectory(dir) {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            searchDirectory(fullPath);
          } else if (item === 'finetuning.jsonl') {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist or be accessible
      }
    }
    
    searchDirectory(pipelineDir);
    return files;
  }

  /**
   * Convert all finetuning files to Vertex AI format
   */
  async convertAllFiles() {
    const files = this.findFineTuningFiles();
    
    if (files.length === 0) {
      console.log('❌ No finetuning.jsonl files found in pipeline directory');
      return;
    }
    
    console.log(`🔍 Found ${files.length} finetuning.jsonl file(s):`);
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    const results = [];
    
    for (const file of files) {
      try {
        // Extract username from path (e.g., pipeline/_takshit/date/processed/finetuning.jsonl)
        const pathParts = file.split(path.sep);
        const userIndex = pathParts.findIndex(part => part.startsWith('_'));
        const username = userIndex >= 0 ? pathParts[userIndex].substring(1) : 'user';
        
        // Create output path
        const dir = path.dirname(file);
        const outputPath = path.join(dir, 'finetuning_vertex_ai.jsonl');
        
        const result = await this.convertFormat(file, outputPath, username);
        result.inputFile = file;
        results.push(result);
        
      } catch (error) {
        console.error(`❌ Failed to convert ${file}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 Conversion Summary:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${path.basename(path.dirname(result.inputFile))}`);
      console.log(`   📥 Input: ${result.originalCount} entries`);
      console.log(`   📤 Output: ${result.convertedCount} entries`);
      console.log(`   📁 File: ${result.outputPath}`);
    });
    
    return results;
  }
}

// CLI Usage
async function main() {
  const converter = new VertexAIConverter();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Convert all files
    console.log('🔄 Converting all finetuning.jsonl files to Vertex AI format...\n');
    await converter.convertAllFiles();
  } else if (args.length >= 2) {
    // Convert specific file
    const [inputPath, outputPath, username] = args;
    await converter.convertFormat(inputPath, outputPath, username || 'user');
  } else {
    console.log('Usage:');
    console.log('  Convert all files: node scripts/convert_to_vertex_ai.js');
    console.log('  Convert specific file: node scripts/convert_to_vertex_ai.js <input_path> <output_path> [username]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default VertexAIConverter; 