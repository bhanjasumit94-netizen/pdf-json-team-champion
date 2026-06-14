import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as xlsx from 'xlsx';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Gen AI client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

// Memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB limit
  }
});

const GEMINI_SYSTEM_INSTRUCTION = `You are an expert Powerlifting Entry Parser.

Your task is to analyze ANY uploaded file data (text, PDF content, image data) and convert all athlete entries into a standardized JSON array of lifters.

========================================
OUTPUT RULES
========================================

Return ONLY valid JSON.
Do NOT return explanations.
Do NOT return markdown.
Do NOT wrap the JSON inside markdown code blocks (like \`\`\`json).
The output must always be a JSON array of lifter objects.

========================================
JSON SCHEMA
========================================

Each object in the array must strictly have this schema:
{
  "district": string or null,
  "name": string,
  "gender": "Men" or "Women",
  "bodyweight_category": string or null,
  "division": "Sub-Junior" | "Junior" | "Senior" | "Open" | "Master 1" | "Master 2" | "Master 3" | "Master 4" | null,
  "entry_fee": number or null,
  "source_page": number or null
}

========================================
DISTRICT DETECTION
========================================

Extract district/unit name from section headers, page headings, or titles.
Examples:
"Paschim Bardhaman District Physical Culture Association" -> "Paschim Bardhaman"
"North 24 Pgs Dist PLA" -> "North 24 Parganas"
"Hooghly District Powerlifting Association" -> "Hooghly"
If unavailable in context, use null.

========================================
GENDER DETECTION
========================================

Search the page or section where the athlete is listed.
If headings or margins contains:
MEN'S LIST, MEN, Male, M -> gender = "Men"
WOMEN'S LIST, WOMEN, Female, W, Wom, Women -> gender = "Women"
Otherwise default to: gender = "Men" (or match context carefully).

========================================
DIVISION NORMALIZATION
========================================

Convert all age categories strictly to:
SUB-JR, SJ, Sub Jr, Sub-Junior -> "Sub-Junior"
JR, Junior -> "Junior"
SR, Senior -> "Senior"
OPEN -> "Open"
M1, M-1, Master 1 -> "Master 1"
M2, M-2, Master 2 -> "Master 2"
M3, M-3, Master 3 -> "Master 3"
M4, M-4, Master 4 -> "Master 4"
If unknown or not found, default or use null.

========================================
BODYWEIGHT CLASS EXTRACTION
========================================

Use IPF bodyweight categories exactly as written.
MEN classes: 53, 59, 66, 74, 83, 93, 105, 120, 120+
WOMEN classes: 43, 47, 52, 57, 63, 69, 76, 84, 84+

Examples:
66-SR -> bodyweight_category = "66", division = "Senior"
105-SJ -> bodyweight_category = "105", division = "Sub-Junior"
+120-M1 -> bodyweight_category = "120+", division = "Master 1"
76-M2 -> bodyweight_category = "76", division = "Master 2"
84+ -> bodyweight_category = "84+"
If bodyweight category is missing, bodyweight_category = null

========================================
ENTRY FEE EXTRACTION
========================================

Extract entry fee numeric value if present.
Examples: 500, 500/-, ₹500 -> 500
1000, 1000/- -> 1000
If unavailable: entry_fee = null

========================================
NAME EXTRACTION RULES
========================================

Extract athlete names exactly as written.
Preserve spacing.
Remove serial numbers.
Do NOT include: Secretary names, President names, Officials, Coaches, Managers, Referees, Signatories, Contact persons. Only include competitors.

========================================
OFFICIALS EXCLUSION
========================================

Ignore any sections titled: Officials, Referees, Coaches, Managers, Office Bearers, Payment Schedule, Total Payment, Signature. These are NOT athletes.

========================================
SOURCE PAGE
========================================

Include the page number where the athlete was found (e.g. 1 if not explicitly page-numbered or a spreadsheet).`;

// Main API handler to parse competitor lists
app.post('/api/parse-competitors', upload.single('file'), async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment secrets.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const filename = file.originalname.toLowerCase();
    const mimeType = file.mimetype;

    console.log(`Processing uploaded file: ${file.originalname} (${mimeType}, ${file.size} bytes)`);

    let responseText = '';

    // Choose parsing pipeline based on file type
    if (
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls') ||
      filename.endsWith('.csv') ||
      filename.endsWith('.ods')
    ) {
      // 1. Spreadsheet Parser using xlsx package
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      let spreadsheetText = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csvContent = xlsx.utils.sheet_to_csv(sheet);
        spreadsheetText += `--- SHEETS: ${sheetName} ---\n${csvContent}\n\n`;
      });

      console.log('Sheet converted to structured text, length:', spreadsheetText.length);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          `You are presented with spreadsheet data exported as CSV strings. Parse all powerlifting entries according to the schema rules.\n\n${spreadsheetText}`
        ],
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                district: { type: Type.STRING, description: "Normalized district or unit (e.g. Paschim Bardhaman, Hooghly, North 24 Parganas) or return empty string" },
                name: { type: Type.STRING, description: "Competitor's full name" },
                gender: { type: Type.STRING, description: "Must be 'Men' or 'Women', return empty string if missing" },
                bodyweight_category: { type: Type.STRING, description: "IPF weight class, e.g. 59, 93, 120+, 76, 84+, or return empty string" },
                division: { type: Type.STRING, description: "Normalized Division: 'Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4', or return empty string" },
                entry_fee: { type: Type.INTEGER, description: "The numeric entry fee or 0 if missing" },
                source_page: { type: Type.INTEGER, description: "The sheet index or page number, starting at 1" }
              },
              required: ['name']
            }
          }
        }
      });

      responseText = response.text || '[]';

    } else if (filename.endsWith('.docx')) {
      // 2. Word document parser using mammoth
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      const rawDocText = result.value;

      console.log('Word Document text extracted, length:', rawDocText.length);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          `You are presented with raw text parsed from a Word Document. Parse all powerlifting entries according to the schema rules.\n\n${rawDocText}`
        ],
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                district: { type: Type.STRING, description: "Normalized district or unit (e.g. Paschim Bardhaman, Hooghly, North 24 Parganas) or return empty string" },
                name: { type: Type.STRING, description: "Competitor's full name" },
                gender: { type: Type.STRING, description: "Must be 'Men' or 'Women', return empty string if missing" },
                bodyweight_category: { type: Type.STRING, description: "IPF weight class, e.g. 59, 93, 120+, 76, 84+, or return empty string" },
                division: { type: Type.STRING, description: "Normalized Division: 'Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4', or return empty string" },
                entry_fee: { type: Type.INTEGER, description: "The numeric entry fee or 0 if missing" },
                source_page: { type: Type.INTEGER, description: "The page number, starting at 1" }
              },
              required: ['name']
            }
          }
        }
      });

      responseText = response.text || '[]';

    } else if (filename.endsWith('.pdf')) {
      // 3. Multi-modal parser (PDF natively parsed by Gemini)
      console.log('Sending PDF natively to Gemini for multimodal list parsing...');

      const pdfPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: file.buffer.toString('base64'),
        }
      };

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            pdfPart,
            'Please read and parse all pages of this PDF document to extract powerlifting entry candidates conforming to the strict competitor rules and format specifications.'
          ],
          config: {
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  district: { type: Type.STRING, description: "Normalized district or unit (e.g. Paschim Bardhaman, Hooghly, North 24 Parganas) or return empty string" },
                  name: { type: Type.STRING, description: "Competitor's full name" },
                  gender: { type: Type.STRING, description: "Must be 'Men' or 'Women', return empty string if missing" },
                  bodyweight_category: { type: Type.STRING, description: "IPF weight class, e.g. 59, 93, 120+, 76, 84+, or return empty string" },
                  division: { type: Type.STRING, description: "Normalized Division: 'Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4', or return empty string" },
                  entry_fee: { type: Type.INTEGER, description: "The numeric entry fee or 0 if missing" },
                  source_page: { type: Type.INTEGER, description: "The page number from the PDF where this row is found" }
                },
                required: ['name']
              }
            }
          }
        });

        responseText = response.text || '[]';
      } catch (geminiError: any) {
        console.warn('Gemini OCR failed for PDF:', geminiError.message);
        throw geminiError;
      }

    } else if (
      mimeType.startsWith('image/') ||
      filename.endsWith('.png') ||
      filename.endsWith('.jpg') ||
      filename.endsWith('.jpeg') ||
      filename.endsWith('.webp') ||
      filename.endsWith('.heic') ||
      filename.endsWith('.heif')
    ) {
      // 4. Multimodal Image parser
      console.log('Sending Image natively to Gemini for visual competitor extraction...');

      // Standardize mimetype for image request
      let standardImageMime = mimeType;
      if (!mimeType.startsWith('image/')) {
        if (filename.endsWith('.png')) standardImageMime = 'image/png';
        else if (filename.endsWith('.webp')) standardImageMime = 'image/webp';
        else standardImageMime = 'image/jpeg';
      }

      const imagePart = {
        inlineData: {
          mimeType: standardImageMime,
          data: file.buffer.toString('base64'),
        }
      };

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            imagePart,
            'Transcribe, OCR, and extract powerlifting lifter entries from this picture or handwritten board/entry list. Return as a clean JSON array.'
          ],
          config: {
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  district: { type: Type.STRING, description: "Normalized district or unit (e.g. Paschim Bardhaman, Hooghly, North 24 Parganas) or return empty string" },
                  name: { type: Type.STRING, description: "Competitor's full name" },
                  gender: { type: Type.STRING, description: "Must be 'Men' or 'Women', return empty string if missing" },
                  bodyweight_category: { type: Type.STRING, description: "IPF weight class, e.g. 59, 93, 120+, 76, 84+, or return empty string" },
                  division: { type: Type.STRING, description: "Normalized Division: 'Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4', or return empty string" },
                  entry_fee: { type: Type.INTEGER, description: "The numeric entry fee or 0 if missing" },
                  source_page: { type: Type.INTEGER, description: "Always defaults to 1 for images unless specified" }
                },
                required: ['name']
              }
            }
          }
        });

        responseText = response.text || '[]';
      } catch (geminiError: any) {
        console.warn('Gemini OCR failed, falling back to Tesseract.js...', geminiError.message);
        try {
          const tesseract = await import('tesseract.js');
          console.log('Running Tesseract OCR...');
          const ret = await tesseract.default.recognize(file.buffer, 'eng');
          const rawText = ret.data.text;
          const lines = rawText.split('\\n').map(l => l.trim()).filter(l => l.length > 3);
          
          const fallbackCompetitors = lines.map(line => {
            // Very simple heuristic for fallback
            // We just shove the line into the name field, and leave others blank.
            // But we can strip basic non-alpha chars at the start (like list numbers).
            let cleanName = line.replace(/^\\W+/, '').substring(0, 100);
            return {
              district: "",
              name: cleanName || 'UNKNOWN',
              gender: "",
              bodyweight_category: "",
              division: "",
              entry_fee: 0,
              source_page: 1
            };
          });
          
          responseText = JSON.stringify(fallbackCompetitors);
        } catch (tesseractError: any) {
          console.error('Tesseract fallback also failed:', tesseractError);
          throw new Error('Image OCR failed on both primary and fallback engines.');
        }
      }

    } else {
      // 5. Raw input text files (.txt, etc.)
      const rawText = file.buffer.toString('utf-8');
      console.log('Sent raw text lines of file directly...');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          `Raw list lines to parse:\n\n${rawText}`
        ],
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                district: { type: Type.STRING, description: "Normalized district or unit or empty string" },
                name: { type: Type.STRING, description: "Competitor's full name" },
                gender: { type: Type.STRING, description: "Must be 'Men' or 'Women' or empty string" },
                bodyweight_category: { type: Type.STRING, description: "IPF weight class, or empty string" },
                division: { type: Type.STRING, description: "Normalized Division: 'Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4', or empty string" },
                entry_fee: { type: Type.INTEGER, description: "The numeric entry fee or 0" },
                source_page: { type: Type.INTEGER, description: "The page number or 1" }
              },
              required: ['name']
            }
          }
        }
      });

      responseText = response.text || '[]';
    }

    console.log(`Successfully generated Gemini parser results.`);

    // Safeguard parsing response text
    let parsedCompetitors = [];
    try {
      parsedCompetitors = JSON.parse(responseText.trim());
    } catch (parseErr) {
      console.error('Error parsing JSON from Gemini response, raw:', responseText);
      // Fallback cleaner regex match for array if there was any trailing garbage
      const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        parsedCompetitors = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error('Gemini did not return valid JSON array structure.');
      }
    }

    return res.status(200).json({
      success: true,
      filename: file.originalname,
      count: parsedCompetitors.length,
      competitors: parsedCompetitors,
    });

  } catch (error: any) {
    console.error('Failed to parse competitor list:', error);
    return res.status(500).json({
      error: error.message || 'Failed to complete powerlifting sheets conversion pipeline.',
    });
  }
});

// Configure Vite or serve static dist directory
if (process.env.NODE_ENV !== 'production') {
  // programmatically import and boot vite dev server integration as middleware
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // production mode serve compiled build assets
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start development/production unified container service on physical port 3000
app.listen(port, () => {
  console.log(`Lifter Sheet parsing platform active on http://localhost:${port}`);
  console.log(`Environment variables loaded: GEMINI_API_KEY is ${apiKey ? 'CONGIGURED' : 'MISSING'}.`);
});
