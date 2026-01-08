import { Template } from '../../core/templates/builtinTemplates';

interface TemplateCardProps {
    template: Template;
    onSelect: (template: Template) => void;
    onDelete?: (template: Template) => void;
    showDelete?: boolean;
}

export const TemplateCard = ({ template, onSelect, onDelete, showDelete = false }: TemplateCardProps) => {
    return (
        <div
            className="relative p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900"
            onClick={() => onSelect(template)}
        >
            {showDelete && !template.is_builtin && onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(template);
                    }}
                    className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 transition"
                    title="Delete template"
                >
                    ×
                </button>
            )}
            
            <div className="flex items-start gap-3">
                {template.icon && (
                    <div className="text-2xl flex-shrink-0">{template.icon}</div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {template.name}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {template.description}
                    </p>
                    {template.is_builtin && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                            Built-in
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

