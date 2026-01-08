import { useState, useEffect } from 'react';
import { useTemplateStore } from '../../core/store/templateStore';
import { Template } from '../../core/templates/builtinTemplates';
import { TemplateCard } from './TemplateCard';
import { FaPlus } from '@react-icons/all-files/fa/FaPlus';
import { FaTimes } from '@react-icons/all-files/fa/FaTimes';

interface TemplateManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TemplateManager = ({ isOpen, onClose }: TemplateManagerProps) => {
    const { templates, loadTemplates, deleteTemplate } = useTemplateStore();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen, loadTemplates]);

    if (!isOpen) return null;

    const customTemplates = Object.values(templates).filter((t) => !t.is_builtin);

    const handleDelete = async (template: Template) => {
        if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
            try {
                await deleteTemplate(template.id);
            } catch (error) {
                alert('Failed to delete template: ' + error);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        Manage Templates
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                    >
                        <FaTimes className="text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            <FaPlus />
                            Create Template from Current Page
                        </button>
                    </div>

                    {showCreateForm && (
                        <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                To create a template, first go to the page you want to save as a template,
                                then use the "Save as Template" button in the editor toolbar.
                            </p>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {customTemplates.length > 0 ? (
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">
                                Your Custom Templates
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {customTemplates.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onSelect={() => {}}
                                        onDelete={handleDelete}
                                        showDelete={true}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                            No custom templates yet. Create one from any page using the "Save as Template" button.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

