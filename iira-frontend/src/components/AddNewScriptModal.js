// src/components/AddNewScriptModal.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save, ChevronDown, Sparkles, Loader2, Wrench } from 'lucide-react'; 
import Modal from './Modal';
// API function names remain unchanged for backend consistency
import { saveScriptApi, updateScriptApi, generateScriptSimpleApi } from '../services/apis'; 

// Component name remains AddNewScriptModal for consistency, file name stays same
const AddNewScriptModal = ({ isOpen, onClose, onScriptAdded, scripts, scriptToEdit }) => { 
    const isEditMode = Boolean(scriptToEdit && scriptToEdit.id);

    // State variable names remain unchanged for simplicity
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [scriptType, setScriptType] = useState('shell_script'); 
    const [params, setParams] = useState([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
    const [modalMessage, setModalMessage] = useState({ visible: false, message: '' });
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Logic to populate form remains the same
            if (scriptToEdit) {
                setName(scriptToEdit.name || '');
                setDescription(scriptToEdit.description || '');
                setTags(Array.isArray(scriptToEdit.tags) ? scriptToEdit.tags.join(', ') : '');
                setContent(scriptToEdit.content || '');
                setScriptType(scriptToEdit.script_type || 'shell_script');
                setParams(scriptToEdit.params && scriptToEdit.params.length > 0 ? scriptToEdit.params : [{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
            } 
            else {
                setName('');
                setDescription('');
                setTags('');
                setContent('');
                setScriptType('shell_script');
                setParams([{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
            }
        }
    }, [isOpen, scriptToEdit]);

    const handleGenerateScript = async () => {
        if (!description.trim()) {
            setModalMessage({ visible: true, message: 'Please provide a description to generate a worker task with AI.' }); 
            return;
        }
        setIsGenerating(true);
        try {
            // API call remains the same
            const generatedTask = await generateScriptSimpleApi(description); 
            setName(generatedTask.name || '');
            // Keep description user entered, don't overwrite with AI one
            // setDescription(generatedTask.description || ''); 
            setContent(generatedTask.content || '');
            setParams(generatedTask.params && generatedTask.params.length > 0 ? generatedTask.params : [{ param_name: '', param_type: 'string', required: true, default_value: '' }]);
            setModalMessage({ visible: true, message: 'AI draft generated successfully!' });
        } catch (error) {
            setModalMessage({ visible: true, message: 'Failed to generate worker task with AI. ' + error.message }); 
        } finally {
            setIsGenerating(false);
        }
    };

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

    const saveScript = async () => { // Function name remains saveScript
        if (!name.trim() || !content.trim()) {
            setModalMessage({ visible: true, message: 'Worker Task Name and Content are required.' }); 
            return;
        }

        // Check if task name exists (logic remains the same)
        // Use 'scripts' prop which holds the list of tasks
        const taskExists = scripts.some( 
            task => task.name.toLowerCase() === name.toLowerCase() && task.id !== (scriptToEdit ? scriptToEdit.id : null)
        );

        if (taskExists) {
            setModalMessage({ visible: true, message: 'A worker task with this name already exists.' }); 
            return;
        }

        // Payload structure remains the same
        const taskPayload = { 
            name,
            description,
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
            content,
            script_type: scriptType, 
            params: params.filter(param => param.param_name.trim())
        };

        try {
            if (isEditMode) {
                // API call remains the same
                await updateScriptApi({ ...taskPayload, id: scriptToEdit.id }); 
                setModalMessage({ visible: true, message: 'Worker Task updated successfully!' }); 
            } else {
                 // API call remains the same
                await saveScriptApi(taskPayload);
                setModalMessage({ visible: true, message: 'Worker Task added successfully!' }); 
            }

            setTimeout(() => {
                setModalMessage({ visible: false, message: '' });
                onClose();
                onScriptAdded(); // Prop name remains unchanged
            }, 1500);

        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} worker task:`, error); 
            setModalMessage({ visible: true, message: error.message });
        }
    };

    const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const modalVariants = {
        hidden: { scale: 0.9, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        exit: { scale: 0.9, opacity: 0 },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 overflow-y-auto"
                    variants={backdropVariants} initial="hidden" animate="visible" exit="hidden"
                >
                    <motion.div 
                        className="bg-white p-6 rounded-3xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200"
                        variants={modalVariants}
                    >
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                            <h3 className="text-2xl font-bold text-blue-800 flex items-center"> 
                                <Wrench size={24} className="mr-2 text-blue-500" /> 
                                {isEditMode ? 'Edit Worker Task' : 'Add New Worker Task'} 
                            </h3>
                            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition duration-300">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            <input type="text" placeholder="Worker Task Name" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            
                            <div className="relative">
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Task Type</label> 
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

                            <div>
                                <textarea placeholder="Worker Task Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button
                                    onClick={handleGenerateScript}
                                    disabled={isGenerating || !description.trim()}
                                    className="flex items-center justify-center w-full px-4 py-2 mt-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-300 disabled:bg-purple-300"
                                >
                                    {isGenerating ? <Loader2 size={20} className="animate-spin mr-2" /> : <Sparkles size={20} className="mr-2" />}
                                    {isGenerating ? 'Generating...' : 'Generate with AI'}
                                </button>
                            </div>
                            <input type="text" placeholder="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <textarea 
                                placeholder="Enter worker task content here..." 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                className="w-full px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg resize-y h-48 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            />

                            <h4 className="text-lg font-bold mt-8 mb-2 text-blue-700">Worker Task Parameters</h4> 
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
                                <Save size={20} className="mr-2" /> {isEditMode ? 'Update Worker Task' : 'Save Worker Task'} 
                            </button>
                        </div>
                        <Modal message={modalMessage.message} visible={modalMessage.visible} onClose={() => setModalMessage({ visible: false, message: '' })} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AddNewScriptModal; 

