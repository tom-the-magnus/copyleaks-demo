require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const app = express();
const path = require('path');
const port = 3000; // You can use any port here

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

// Function to submit files to Copyleaks
async function submitFileToCopyLeaks(filePath){
    try {
        // Authenticate with API to get token
        const authResponse = await axios.post('https://id.copyleaks.com/v3/account/login/api', {
            email: process.env.EMAIL,
            key: process.env.API_KEY
        });

        // authToken created
        const authToken = authResponse.data.access_token;

        // Generate a random scanId
        const scanId = generateScanId(); // Use the function to generate a scanId

        // Read the file and convert to base64
        const fileContent = await fs.readFile(filePath, {encoding: 'base64'});
        const filename = path.basename(filePath); // Extracts the filename from the path

        // Step 2: Submit the file using scanID
        const submitResponse = await axios.put(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
            base64: fileContent,
            filename: filename
        },{
            headers: {
                // Bearer tokens use back-ticks
                'Authorization': `Bearer ${authToken}`,
                'Content-Type':'application/json'
            }
        });

        console.log('File submitted successfully', submitResponse.data);
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Error response data:', error.response.data);
            console.error('Error status:', error.response.status);
            console.error('Error headers:', error.response.headers);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Error request:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error message:', error.message);
        }
        console.error('Error config:', error.config);
    }    
}

// Set storage engine
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'upload/')
    },
    filename: function(req,file,cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});

// Initialize upload varialbe
const upload = multer({storage:storage})

app.use(express.static('public'));

// Handle file uploads
app.post('/upload', upload.single('file'),(req, res) => {
    submitFileToCopyLeaks(req.file.path).then(() => {
        res.send('Upload route hit successfully');
    }).catch(error => {
        res.status(500).send('Failed to submit file to Copyleaks.');
    });
});

app.get('/', (req, res) => {
  res.send('The server is running');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});