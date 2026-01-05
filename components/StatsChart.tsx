import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order } from '../types';

interface StatsChartProps {
  orders: Order[];
}

const StatsChart: React.FC<StatsChartProps> = ({ orders }) => {
  
  const data = useMemo(() => {
    const grouped = orders.reduce((acc, order) => {
      const date = new Date(order.date);
      const key = `${date.toLocaleString('es-ES', { month: 'short' })}`.toUpperCase(); // MAY, JUN
      
      if (!acc[key]) {
        acc[key] = { name: key, total: 0 };
      }
      acc[key].total += order.amount;
      return acc;
    }, {} as Record<string, { name: string, total: number }>);

    return Object.values(grouped).reverse(); // Simplistic sorting for demo
  }, [orders]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-8">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Gastos Mensuales</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(2)}`, 'Total']}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
               {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#3b82f6" />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;