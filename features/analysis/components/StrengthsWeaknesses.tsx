import React from 'react';

interface Props {
    strengths?: string[];
    weaknesses?: string[];
}

const Section: React.FC<{
  title: string;
  items: string[];
  accentColor: 'green' | 'red';
  iconPath: string;
  emptyLabel: string;
}> = ({ title, items, accentColor, iconPath, emptyLabel }) => (
  <div>
    <h3
      className={`text-lg font-serif font-bold text-${accentColor}-800 border-b border-${accentColor}-100 pb-2 mb-3 flex items-center gap-2`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
      </svg>
      {title}
    </h3>
    {items.length > 0 ? (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className={`flex items-start gap-2 text-sm text-gray-700 bg-${accentColor}-50/50 p-2 rounded border border-${accentColor}-100`}
          >
            <span className={`text-${accentColor}-500 mt-0.5`}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-gray-500 italic">{emptyLabel}</p>
    )}
  </div>
);

export const StrengthsWeaknesses: React.FC<Props> = ({
  strengths = [],
  weaknesses = [],
}) => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Section
        title="Key Strengths"
        items={strengths}
        accentColor="green"
        iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        emptyLabel="No specific strengths listed."
      />
      <Section
        title="Areas for Improvement"
        items={weaknesses}
        accentColor="red"
        iconPath="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        emptyLabel="No specific weaknesses listed."
      />
    </div>
  );
};