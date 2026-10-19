import React, { useState } from 'react';
import { Transaction, CATEGORY_COLORS, DEFAULT_CATEGORY_FILL } from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface CategoryPieChartProps {
  transactions: Transaction[];
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string | null;
}

interface SliceData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  startAngle: number;
  endAngle: number;
  pathData: string;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  transactions,
  onSelectCategory,
  selectedCategory,
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Filter only expenses
  // Sørg for at den aldrig crasher, selv hvis transactions er undefined
  transactions = Array.isArray(transactions) ? transactions : [];
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a);

  // SVG Geometry for Donut Chart
  const size = 260;
  const center = size / 2;
  const radius = 100;
  const innerRadius = 64;

  let currentAngle = -Math.PI / 2; // start from top (12 o'clock)
  const slices: SliceData[] = sortedCategories.map(([category, amount]) => {
    const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
    const sliceAngle = totalExpense > 0 ? (amount / totalExpense) * 2 * Math.PI : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    // Calculate arc coordinates
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(startAngle);
    const y4 = center + innerRadius * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = totalExpense > 0 && sortedCategories.length === 1
      ? // Full circle donut if only 1 category
        `M ${center} ${center - radius}
         A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius}
         L ${center - 0.001} ${center - innerRadius}
         A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius}
         Z`
      : `M ${x1} ${y1} 
         A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} 
         L ${x3} ${y3} 
         A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} 
         Z`;

    const color = CATEGORY_COLORS[category]?.fill || DEFAULT_CATEGORY_FILL;

    return {
      category,
      amount,
      percentage,
      color,
      startAngle,
      endAngle,
      pathData,
    };
  });

  const activeCategory = hoveredCategory || selectedCategory;
  const activeSlice = slices.find((s) => s.category === activeCategory);

  if (totalExpense === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200/80 rounded-xl h-72 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 font-mono text-sm">
          0 kr
        </div>
        <p className="text-sm font-medium text-slate-700">Ingen registrerede udgifter</p>
        <p className="text-xs text-slate-500 mt-1">Tilføj en udgiftspostering for at se fordelingen</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Udgifter fordelt på kategorier</h3>
          <p className="text-xs text-slate-500 mt-0.5">Samlet udgiftsbeløb for perioden</p>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {sortedCategories.length} {sortedCategories.length === 1 ? 'kategori' : 'kategorier'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-5">
        {/* Interactive SVG Donut */}
        <div className="md:col-span-6 flex flex-col items-center justify-center relative">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible select-none"
          >
            {slices.map((slice) => {
              const isHovered = hoveredCategory === slice.category;
              const isSelected = selectedCategory === slice.category;
              const isDimmed = activeCategory && !isHovered && !isSelected;

              return (
                <path
                  key={slice.category}
                  d={slice.pathData}
                  fill={slice.color}
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    transformOrigin: `${center}px ${center}px`,
                    transform: isHovered || isSelected ? 'scale(1.03)' : 'scale(1)',
                    filter: isHovered || isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))' : 'none',
                  }}
                  onMouseEnter={() => setHoveredCategory(slice.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => onSelectCategory && onSelectCategory(slice.category)}
                />
              );
            })}

            {/* Center Information Ring */}
            <circle cx={center} cy={center} r={innerRadius - 4} fill="#FFFFFF" />
          </svg>

          {/* Center Dynamic Label Overlay */}
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none text-center px-4"
            style={{ width: innerRadius * 2, height: innerRadius * 2 }}
          >
            {activeSlice ? (
              <>
                <span className="text-[11px] font-medium text-slate-500 truncate max-w-[100px]">
                  {activeSlice.category}
                </span>
                <span className="text-sm font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
                  {formatCurrency(activeSlice.amount)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {activeSlice.percentage.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase font-medium text-slate-400 tracking-wider">
                  Total
                </span>
                <span className="text-sm font-bold text-slate-900 font-mono tracking-tight mt-0.5">
                  {formatCurrency(totalExpense)}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">100%</span>
              </>
            )}
          </div>
        </div>

        {/* Legend & Breakdown List */}
        <div className="md:col-span-6 space-y-2.5">
          {slices.map((slice) => {
            const isHovered = hoveredCategory === slice.category;
            const isSelected = selectedCategory === slice.category;

            return (
              <button
                key={slice.category}
                type="button"
                onClick={() => onSelectCategory && onSelectCategory(slice.category)}
                onMouseEnter={() => setHoveredCategory(slice.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={`w-full text-left p-2 rounded-lg transition-colors border ${
                  isSelected
                    ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-400'
                    : isHovered
                    ? 'border-slate-200 bg-slate-50/80'
                    : 'border-transparent hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-medium text-slate-800 truncate">{slice.category}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span className="text-slate-500 font-mono text-[11px]">
                      {slice.percentage.toFixed(1)}%
                    </span>
                    <span className="font-mono font-semibold text-slate-900 text-xs">
                      {formatCurrency(slice.amount)}
                    </span>
                  </div>
                </div>

                {/* Micro bar */}
                <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${slice.percentage}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
