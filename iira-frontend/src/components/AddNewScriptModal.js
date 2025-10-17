// src/components/AddNewScriptModal.js
import React, { useState, useEffect } from 'react';
import { Plus, X, Save, ChevronDown } from 'lucide-react';
import Modal from './Modal'; // Assuming a simple modal component
import { saveScriptApi, updateScriptApi } from '../services/apis';

const AddNewScriptModal = ({ isOpen, onClose, onScriptAdded, scripts, scriptToEdit }) => {
    // This logic is now correct for determining the mode.
    const isEditMode = Boolean(scriptToEdit && scriptToEdit.id);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [scriptType, setScriptType] = useState('shell_script');
    const [params, setParams] = useState([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
    const [modalMessage, setModalMessage] = useState({ visible: false, message: '' });

    // --- MODIFICATION: Updated useEffect to handle three states ---
    useEffect(() => {
        if (isOpen) {
            // Case 1 & 2: If there is a script object passed (either for editing or AI pre-fill)
            if (scriptToEdit) {
                setName(scriptToEdit.name || '');
                setDescription(scriptToEdit.description || '');
                setTags(Array.isArray(scriptToEdit.tags) ? scriptToEdit.tags.join(', ') : '');
                setContent(scriptToEdit.content || '');
                setScriptType(scriptToEdit.script_type || 'shell_script');
                // Ensure params are an array, even if the AI returns an empty one
                setParams(scriptToEdit.params && scriptToEdit.params.length > 0 ? scriptToEdit.params : [{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
            } 
            // Case 3: If there is no script object, it's a blank "Add New"
            else {
                setName('');
                setDescription('');
                setTags('');
                setContent('');
                setScriptType('shell_script');
                setParams([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
            }
        }
    }, [isOpen, scriptToEdit]); // This effect now correctly depends on the scriptToEdit object itself.
    // --- END MODIFICATION ---

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
        if (!name.trim() || !content.trim()) {
            setModalMessage({ visible: true, message: 'Script Name and Script Content are required.' });
            return;
        }

        const scriptExists = scripts.some(
            script => script.name.toLowerCase() === name.toLowerCase() && script.id !== (scriptToEdit ? scriptToEdit.id : null)
        );

        if (scriptExists) {
            setModalMessage({ visible: true, message: 'A script with this name already exists.' });
            return;
        }

        const scriptPayload = {
            name,
            description,
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
            content,
            script_type: scriptType,
            params: params.filter(param => param.param_name.trim())
        };

        try {
            if (isEditMode) {
                await updateScriptApi({ ...scriptPayload, id: scriptToEdit.id });
                setModalMessage({ visible: true, message: 'Script updated successfully!' });
            } else {
                await saveScriptApi(scriptPayload);
                setModalMessage({ visible: true, message: 'Script added successfully!' });
            }

            setTimeout(() => {
                setModalMessage({ visible: false, message: '' });
                onClose();
                onScriptAdded();
            }, 1500);

        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} script:`, error);
            setModalMessage({ visible: true, message: error.message });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto">
            <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h3 className="text-2xl font-bold text-blue-800">{isEditMode ? 'Edit Script' : 'Add New Script'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition duration-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <input type="text" placeholder="Script Name" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-600 mb-1 block">Script Type</label>
                        <select 
                            value={scriptType} 
                            onChange={e => setScriptType(e.target.value)} 
                            className="block w-full appearance-none bg-white border border-gray-300 px-4 py-3 rounded-lg pr-8 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="shell_script">Shell Script</option>
                            <option value="python_script" disabled>Python Script (coming soon)</option>
                            <option value="powershell_script" disabled>PowerShell (coming soon)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-2 text-gray-700"><ChevronDown className="h-4 w-4" /></div>
                    </div>

                    <textarea placeholder="Script Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <textarea 
                        placeholder="Enter your script content here..." 
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        className="w-full px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg resize-y h-48 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />

                    <h4 className="text-lg font-bold mt-8 mb-2 text-blue-700">Script Parameters</h4>
                    {params.map((param, index) => (
                        <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                            <input type="text" placeholder="Param Name" value={param.param_name} onChange={e => handleParamChange(index, 'param_name', e.target.value)} className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <div className="relative w-full sm:w-auto">
                                <select value={param.param_type} onChange={e => handleParamChange(index, 'param_type', e.target.value)} className="block w-full sm:w-32 appearance-none bg-white border border-gray-300 px-4 py-3 rounded-lg pr-8 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500" >
                                    <option value="string">string</option><option value="int">int</option><option value="bool">bool</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown className="h-4 w-4" /></div>
                            </div>
                            <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={param.required} onChange={e => handleParamChange(index, 'required', e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                                <span className="text-gray-700">Required</span>
                            </label>
                            <input type="text" placeholder="Default Value" value={param.default_value || ''} onChange={e => handleParamChange(index, 'default_value', e.target.value)} className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {params.length > 1 && (<button onClick={() => removeParam(index)} className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200" ><X size={20} /></button>)}
                        </div>
                    ))}
                    <button onClick={addParam} className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600" >
                        <Plus size={20} className="mr-2" /> Add Parameter
                    </button>
                </div>

                <div className="flex justify-end mt-6 space-x-3">
                    <button onClick={saveScript} className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700" >
                        <Save size={20} className="mr-2" /> {isEditMode ? 'Update Script' : 'Save Script'}
                    </button>
                </div>
                <Modal message={modalMessage.message} visible={modalMessage.visible} onClose={() => setModalMessage({ visible: false, message: '' })} />
            </div>
        </div>
    );
};

export default AddNewScriptModal;

