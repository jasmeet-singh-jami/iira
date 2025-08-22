// src/components/AddNewScriptModal.js
import React, { useState } from 'react';
import axios from 'axios';
import { Plus, X, Save, ChevronDown } from 'lucide-react';
import Modal from './Modal';

const AddNewScriptModal = ({ isOpen, onClose, onScriptAdded, scripts }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [path, setPath] = useState('');
    const [params, setParams] = useState([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
    const [modalMessage, setModalMessage] = useState({ visible: false, message: '' });

    const handleParamChange = (index, field, value) => {
        const updatedParams = [...params];
        updatedParams[index][field] = value;
        setParams(updatedParams);
    };

    const addParam = () => {
        setParams([...params, { param_name: '', param_type: 'string', required: true, default_value: '' }]);
    };

    const removeParam = (index) => {
        const updatedParams = params.filter((_, i) => i !== index);
        setParams(updatedParams);
    };

    const saveScript = async () => {
        if (!name.trim() || !path.trim()) {
            setModalMessage({ visible: true, message: 'Script Name and Path are required.' });
            return;
        }

        const scriptExists = scripts.some(script => script.name.toLowerCase() === name.toLowerCase());
        if (scriptExists) {
            setModalMessage({ visible: true, message: 'A script with this name already exists. Please choose a different name.' });
            return;
        }

        const newScript = {
            name,
            description,
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
            path,
            params: params.filter(param => param.param_name.trim())
        };

        try {
            const response = await axios.post("http://localhost:8000/scripts/add", newScript);

            if (response.status === 200) {
                setModalMessage({ visible: true, message: 'Script added successfully!' });
                setName('');
                setDescription('');
                setTags('');
                setPath('');
                setParams([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
                setTimeout(() => {
                    onClose();
                    onScriptAdded();
                }, 1500);
            } else {
                setModalMessage({ visible: true, message: 'Failed to add new script. Please check the backend response.' });
            }
        } catch (error) {
            console.error("Error adding new script:", error);
            setModalMessage({ visible: true, message: 'Failed to add new script. Please check the API server.' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto">
            <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h3 className="text-2xl font-bold text-blue-800">Add New Script</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition duration-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <input type="text" placeholder="Script Name" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <textarea placeholder="Script Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Tags (comma-separated, e.g., 'server, restart, web')" value={tags} onChange={e => setTags(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Script Path or Command (e.g., /usr/bin/restart_server.sh)" value={path} onChange={e => setPath(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />

                    <h4 className="text-lg font-bold mt-8 mb-2 text-blue-700">Script Parameters:</h4>
                    {params.map((param, index) => (
                        <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                            <input type="text" placeholder="Param Name" value={param.param_name} onChange={e => handleParamChange(index, 'param_name', e.target.value)} className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <div className="relative w-full sm:w-auto">
                                <select value={param.param_type} onChange={e => handleParamChange(index, 'param_type', e.target.value)} className="block w-full sm:w-32 appearance-none bg-white border border-gray-300 px-4 py-3 rounded-lg pr-8 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500" >
                                    <option value="string">string</option><option value="int">int</option><option value="bool">bool</option><option value="float">float</option><option value="file">file</option><option value="enum">enum</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown className="h-4 w-4" /></div>
                            </div>
                            <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={param.required} onChange={e => handleParamChange(index, 'required', e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                                <span className="text-gray-700">Required</span>
                            </label>
                            <input type="text" placeholder="Default Value" value={param.default_value} onChange={e => handleParamChange(index, 'default_value', e.target.value)} className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {params.length > 1 && (<button onClick={() => removeParam(index)} className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition duration-200" ><X size={20} /></button>)}
                        </div>
                    ))}
                    <button onClick={addParam} className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 mt-4" >
                        <Plus size={20} className="mr-2" /> Add Parameter
                    </button>
                </div>

                <div className="flex justify-end mt-6 space-x-3">
                    <button onClick={saveScript} className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-300" >
                        <Save size={20} className="mr-2" /> Save Script
                    </button>
                </div>
                <Modal message={modalMessage.message} onClose={() => setModalMessage({ visible: false, message: '' })} />
            </div>
        </div>
    );
};

export default AddNewScriptModal;