require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const app = express();
app.use(express.json());
const path = require('path');
const port = 3000; 

// Generate random scan ID
function generateScanId(length = 10) {
    let result = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// Token caching mechanism
let cachedToken = {
    value: null,
    expiry: null
};

async function getAuthToken() {
    // Token cache checker
    const now = new Date();
    if (cachedToken.value && cachedToken.expiry && cachedToken.expiry > now) {
        return cachedToken.value;
    }

    // Otherwise, request a new token
    const response = await axios.post('https://id.copyleaks.com/v3/account/login/api', {
        email: process.env.EMAIL,
        key: process.env.API_KEY
    });

    const expiresIn = response.data.expiresIn || 3600; // Assuming expiresIn is in seconds
    cachedToken = {
        value: response.data.access_token,
        expiry: new Date(now.getTime() + expiresIn * 1000) // Convert expiresIn to milliseconds and add to current time
    };

    return cachedToken.value;
}

// Function to submit files to Copyleaks
async function submitUrlToCopyLeaks(scanUrl) {
    try {
        // create authToken
        const authToken = await getAuthToken();
        const scanId = generateScanId(); // Use the function to generate a scanId

        const requestBody = {
            url: scanUrl,
            properties: {
                sandbox: true,
                webhooks: {
                    status: `https://eo9fzrc0ptg7yg.m.pipedream.net/{STATUS}/${scanId}`
                }
            }
        };

        // Corrected axios request
        const response = await axios.put(
            `https://api.copyleaks.com/v3/scans/submit/url/${scanId}`,
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('URL submitted successfully', response.data);
    } catch (error) {
        console.error('Failed to submit URL:', error.response ? error.response.data : error.message);
    }
}

// Function to submit files to Copyleaks
async function submitFileToCopyLeaks(filePath) {
    const authToken = await getAuthToken();
    const scanId = generateScanId();
    const fileContent = await fs.readFile(filePath, {encoding: 'base64'});
    const filename = path.basename(filePath);

    await axios.put(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
        base64: fileContent,
        filename: filename,
        properties: {
            sandbox: true,
            webhooks: {
                status: `https://eo9fzrc0ptg7yg.m.pipedream.net/{STATUS}/${scanId}`
            }
        }
    }, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    });
}

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'upload/'),
    filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Handle file uploads and submissions
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    try {
        await submitFileToCopyLeaks(req.file.path);
        res.send('File uploaded and submitted successfully.');
    } catch (error) {
        console.error('Error submitting file:', error);
        res.status(500).send('Failed to submit file.');
    }
});

// Handle Url uploads
app.post('/submit-url', async (req, res) => {
    const scanUrl = req.body.url;

    if (!scanUrl) {
        return res.status(400).send('No URL provided');
    }

    try {
        await submitUrlToCopyLeaks(scanUrl);
        res.send('URL submitted successfully');
    } catch (error) {
        console.error('Submission failed:', error);
        res.status(500).send('Failed to submit URL to Copyleaks.');
    }
});

app.get('/', (req, res) => {
    res.send('The server is running');
  });
  
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});