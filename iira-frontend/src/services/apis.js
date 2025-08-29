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
 * @param {string} incidentNumber - The number of the incident to resolve.
 * @returns {Promise<Object>} A promise that resolves to the incident resolution data.
 */
export const resolveIncidentApi = async (incidentNumber) => {
    try {
        const response = await axios.get(`${API_BASE}/api/incident/${incidentNumber}`);
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
export const fetchHistoryApi = async () => {
    try {
        const response = await axios.get(`${API_BASE}/api/history`);
        return response.data.history;
    } catch (error) {
        throw new Error('Failed to fetch incident history.');
    }
};

