// BarChart.jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * BarChart component to display beverage consumption data.
 * It takes data as props and renders a responsive bar graph.
 *
 * @param {Object[]} data - An array of objects, where each object represents a beverage.
 * Each object should have at least 'name' (string) and 'totalSold' (number) properties.
 * Example: [{ name: 'Cola', totalSold: 150 }, { name: 'Water', totalSold: 100 }]
 */
const CustomBarChart = ({ data }) => {
  return (
    <div className="w-full h-96 p-4 bg-white rounded-lg shadow-lg">
      {/* ResponsiveContainer makes the chart responsive to its parent's size */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {/* CartesianGrid adds a grid to the chart for better readability */}
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          {/* XAxis displays the beverage names */}
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0}
            tick={{ fill: '#4a4a4a', fontSize: 12 }}
            // Dynamically adjust tick font size for smaller screens
            className="text-xs sm:text-sm"
          />
          {/* YAxis displays the total units sold */}
          <YAxis label={{ value: 'Units Sold', angle: -90, position: 'insideLeft', fill: '#4a4a4a' }}
            tick={{ fill: '#4a4a4a', fontSize: 12 }}
          />
          {/* Tooltip shows details when hovering over a bar */}
          <Tooltip 
            cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px', color: '#fff' }}
            labelStyle={{ color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          {/* Legend provides a key for the data series */}
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {/* Bar represents the data. The fill color is a vibrant blue. */}
          <Bar dataKey="totalSold" name="Units Sold" fill="#60A5FA" barSize={30} radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CustomBarChart;
