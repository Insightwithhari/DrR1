import React, { useState, useMemo } from 'react';
import type { BlastHit } from '../types';

declare const window: any;

interface BlastViewerProps {
  data: BlastHit[];
}

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2 bg-slate-700 text-white rounded-md shadow-lg border border-slate-600 text-sm">
        <p className="font-bold max-w-xs truncate">{data.description}</p>
        <p className="primary-text">{`Score: ${data.score}`}</p>
        <p>{`E-value: ${data.e_value}`}</p>
        <p>{`Identity: ${(data.identity * 100).toFixed(1)}%`}</p>
      </div>
    );
  }
  return null;
};

const BlastChart: React.FC<{ data: BlastHit[] }> = ({ data }) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = window.Recharts;
    const chartData = data.map(hit => ({
        ...hit,
        shortDescription: hit.description.length > 30 ? `${hit.description.substring(0, 30)}...` : hit.description,
    }));

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
                    <XAxis type="number" />
                    <YAxis dataKey="shortDescription" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="score" fill="var(--primary-color)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const SortableTable: React.FC<{ data: BlastHit[] }> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof BlastHit; direction: 'asc' | 'desc' } | null>({ key: 'score', direction: 'desc' });

    const sortedData = useMemo(() => {
        let sortableData = [...data];
        if (sortConfig !== null) {
            sortableData.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const requestSort = (key: keyof BlastHit) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: keyof BlastHit) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-200 dark:bg-slate-700">
                    <tr>
                        <th className="p-2">Description</th>
                        <th className="p-2 cursor-pointer" onClick={() => requestSort('score')}>Score{getSortIndicator('score')}</th>
                        <th className="p-2 cursor-pointer" onClick={() => requestSort('e_value')}>E-value{getSortIndicator('e_value')}</th>
                        <th className="p-2 cursor-pointer" onClick={() => requestSort('identity')}>Identity{getSortIndicator('identity')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((hit, index) => (
                        <tr key={index} className="border-b border-[var(--border-color)]">
                            <td className="p-2">{hit.description}</td>
                            <td className="p-2">{hit.score}</td>
                            <td className="p-2">{hit.e_value}</td>
                            <td className="p-2">{(hit.identity * 100).toFixed(1)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const BlastViewer: React.FC<BlastViewerProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <div>
      <div className="flex justify-end gap-1 mb-2">
        <button onClick={() => setViewMode('chart')} className={`px-3 py-1 text-xs rounded-full ${viewMode === 'chart' ? 'primary-bg text-white' : 'bg-slate-200 dark:bg-slate-600'}`}>Chart</button>
        <button onClick={() => setViewMode('table')} className={`px-3 py-1 text-xs rounded-full ${viewMode === 'table' ? 'primary-bg text-white' : 'bg-slate-200 dark:bg-slate-600'}`}>Table</button>
      </div>
      {viewMode === 'chart' ? <BlastChart data={data} /> : <SortableTable data={data} />}
    </div>
  );
};

export default BlastViewer;