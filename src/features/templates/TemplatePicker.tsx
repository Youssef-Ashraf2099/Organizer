import { useState, useEffect } from 'react';
import { useTemplateStore } from '../../core/store/templateStore';
import { Template } from '../../core/templates/builtinTemplates';
import { TemplateCard } from './TemplateCard';
import { FaTimes } from '@react-icons/all-files/fa/FaTimes';

interface TemplatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (template: Template | null) => void;
}

export const TemplatePicker = ({ isOpen, onClose, onSelect }: TemplatePickerProps) => {
    const { templates, loadTemplates, initializeBuiltinTemplates } = useTemplateStore();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadTemplates().then(() => {
                initializeBuiltinTemplates();
            });
        }
    }, [isOpen, loadTemplates, initializeBuiltinTemplates]);

    if (!isOpen) return null;

    const templateList = Object.values(templates);
    const builtinTemplates = templateList.filter((t) => t.is_builtin);
    const customTemplates = templateList.filter((t) => !t.is_builtin);

    const filteredBuiltin = builtinTemplates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredCustom = customTemplates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (template: Template) => {
        onSelect(template);
        onClose();
    };

    const handleBlank = () => {
        onSelect(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        Choose a Template
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                    >
                        <FaTimes className="text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={handleBlank}
                        className="w-full p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 transition mb-6 text-zinc-600 dark:text-zinc-400"
                    >
                        <div className="text-center">
                            <div className="text-2xl mb-2">📄</div>
                            <div className="font-medium">Blank Page</div>
                            <div className="text-sm">Start with an empty page</div>
                        </div>
                    </button>

                    {filteredBuiltin.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">
                                Built-in Templates
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredBuiltin.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onSelect={handleSelect}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredCustom.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">
                                Your Templates
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredCustom.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onSelect={handleSelect}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredBuiltin.length === 0 && filteredCustom.length === 0 && (
                        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                            No templates found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

