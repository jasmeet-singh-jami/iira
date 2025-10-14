// src/services/apis.js
import axios from 'axios';

// Proxy all requests that start with /api to the backend service configured in nginx.conf.
const API_BASE = "";

/**
 * Fetches the list of all available scripts from the backend.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of script objects.
 */
export const fetchScriptsApi = async () => {
    try {
        const response = await axios.get(`${API_BASE}/api/scripts`);
        return response.data.scripts;
    } catch (error) {
        console.error("API Error: Error fetching scripts:", error);
        throw new Error('Failed to load scripts from the backend. Please check the API server.');
    }
};

/**
 * Uploads a new SOP to the backend.
 * @param {Object} sopData - The SOP data to be ingested.
 * @returns {Promise<Object>} A promise that resolves to the API response data.
 */
export const uploadSOPApi = async (sopData) => {
    try {
        const response = await axios.post(`${API_BASE}/api/ingest`, { sops: [sopData] });
        return response.data;
    } catch (error) {
        console.error("API Error: Error ingesting SOP:", error);
        throw new Error('Failed to ingest SOP. Please check the API server.');
    }
};

/**
 * Resolves an incident by fetching relevant SOPs and scripts.
 * This function is specifically for the "Test Bed" and will not log to history.
 * @param {string} incidentNumber - The number of the incident to resolve.
 * @returns {Promise<Object>} A promise that resolves to the incident resolution data.
 */
export const resolveIncidentApi = async (incidentNumber) => {
    try {
        const response = await axios.get(`${API_BASE}/api/incident/${incidentNumber}`, {
            params: {
                source: 'test_bed'
            }
        });
        return response.data;
    } catch (error) {
        console.error("API Error: Incident resolution failed:", error);
        throw new Error('Incident resolution failed. Please try again or check the incident number.');
    }
};

/**
 * Executes a specific script on the backend.
 * @param {string} scriptId - The ID of the script to execute.
 * @param {string} scriptName - The name of the script.
 * @param {Object} parameters - The parameters for the script execution.
 * @returns {Promise<Object>} A promise that resolves to the script execution result.
 */
export const executeScriptApi = async (scriptId, scriptName, parameters) => {
    try {
        const response = await axios.post(`${API_BASE}/api/execute_script`, {
            script_id: scriptId,
            script_name: scriptName,
            parameters: parameters
        });
        return response.data;
    } catch (error) {
        console.error("API Error: Script execution failed:", error);
        throw new Error('Script execution failed. Please check the backend API server.');
    }
};

// Saves a new script with its parameters to the backend.
export const saveScriptApi = async (newScript) => {
    try {
        const response = await axios.post(`${API_BASE}/api/scripts/add`, newScript);
        return response.data;
    } catch (error) {
        throw new Error('Failed to add new script. Please check the API server.');
    }
};

// function to fetch incident history
export const fetchHistoryApi = async (page = 1, limit = 10) => {
  try {
    const response = await axios.get(`${API_BASE}/api/history`, {
      params: { page, limit },
    });
    return response.data; // contains { history, total_records, total_pages, current_page }
  } catch (error) {
    throw new Error("Failed to fetch incident history.");
  }
};

/**
 * Deletes an SOP from the backend by its title.
 * @param {string} title - The title of the SOP to delete.
 * @returns {Promise<Object>} A promise that resolves to the API response data.
 */
export const deleteSOPApi = async (sopId) => {
    try {
        const response = await axios.post(`${API_BASE}/api/delete_sop`, {
            sop_id: sopId
        });
        return response.data;
    } catch (error) {
        console.error("API Error: Error deleting SOP:", error);
        throw new Error('Failed to delete SOP. Please check the API server.');
    }
};

export const fetchAllSOPsApi = async () => {
    try {
        const response = await axios.get(`${API_BASE}/api/sops/all`);
        return response.data;
    } catch (error) {
        console.error("API Error: Error fetching SOPs:", error);
        throw new Error('Failed to fetch all SOPs. Please check the API server.');
    }
};

/**
 * Function to parse raw text into structured SOP data.
 * @param {string} document_text - The raw text of the SOP document.
 * @returns {Promise<Object>} A promise that resolves to the structured SOP data.
 */
export const parseSOPApi = async (document_text) => {
    try {
        const response = await axios.post(`${API_BASE}/api/parse_sop`, { document_text });
        return response.data;
    } catch (error) {
        console.error("API Error: Error parsing SOP:", error);
        throw new Error('Failed to parse SOP document. Please check the API server.');
    }
};

/**
 * Updates an existing script in the backend.
 * @param {Object} scriptData - The full script object, including its ID.
 * @returns {Promise<Object>} A promise that resolves to the API response data.
 */
export const updateScriptApi = async (scriptData) => {
    try {
        // Use a PUT request to the new /api/scripts/update endpoint
        const response = await axios.put(`${API_BASE}/api/scripts/update`, scriptData);
        return response.data;
    } catch (error) {
        console.error("API Error: Error updating script:", error);
        // Provide more specific error feedback from the backend if possible
        const errorMessage = error.response?.data?.detail || 'Failed to update script. Please check the API server.';
        throw new Error(errorMessage);
    }
};

export const deleteScriptApi = async (scriptId) => {
    try {
        const response = await axios.delete(`${API_BASE}/api/scripts/delete/${scriptId}`);
        return response.data;
    } catch (error) {
        console.error("API Error: Error deleting script:", error);
        const errorMessage = error.response?.data?.detail || 'Failed to delete script. Please check the API server.';
        throw new Error(errorMessage);
    }
};

export const matchScriptApi = async (description) => {
    try {
        const response = await axios.post(`${API_BASE}/api/scripts/match`, { description });
        return response.data;
    } catch (error) {
        console.error("API Error: Error matching script:", error);
        throw new Error('Failed to find a matching script.');
    }
};

export const generateSOPApi = async (problemDescription, answers) => {
    try {
        const payload = {
            problem_description: problemDescription,
            answers: answers,
        };
        const response = await axios.post(`${API_BASE}/api/generate_sop`, payload);
        return response.data;
    } catch (error) {
        console.error("API Error: Error generating SOP:", error);
        const errorMessage = error.response?.data?.detail || 'Failed to generate SOP with AI. Please check the API server.';
        throw new Error(errorMessage);
    }
};

export const fetchSystemStatsApi = async () => {
    try {
        const response = await axios.get(`${API_BASE}/api/system/stats`);
        return response.data;
    } catch (error) {
        console.error("API Error: Error fetching system stats:", error);
        throw new Error('Failed to fetch system statistics.');
    }
};

export const fetchActivityLogApi = async (page = 1, limit = 5) => {
    try {
        const response = await axios.get(`${API_BASE}/api/activity_log`, {
            params: { page, limit }
        });
        // This includes { activities, current_page, total_pages }
        return response.data;
    } catch (error) {
        console.error("API Error: Error fetching activity log:", error);
        throw new Error('Failed to fetch the system activity log.');
    }
};
