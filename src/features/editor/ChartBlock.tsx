import { createReactBlockSpec } from "@blocknote/react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { useState } from "react";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

type ChartType = "bar" | "line" | "pie";

export const ChartBlock = createReactBlockSpec(
  {
    type: "chart",
    propSchema: {
      chartType: { default: "bar" },
      width: { default: 100 },
      height: { default: 320 },
      data: {
        default: {
          labels: ["Jan", "Feb", "Mar", "Apr"],
          datasets: [
            {
              label: "Income",
              data: [1200, 1500, 1100, 1800],
              backgroundColor: "rgba(34,197,94,0.7)",
              borderColor: "rgb(34,197,94)",
            },
            {
              label: "Expenses",
              data: [800, 1000, 900, 1200],
              backgroundColor: "rgba(239,68,68,0.7)",
              borderColor: "rgb(239,68,68)",
            },
          ],
        },
      },
      options: {
        default: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" as const },
            title: { display: false },
          },
        },
      },
    },
    content: "none",
  } as any,
  {
    render: (props) => {
      const chartType = props.block.props.chartType as ChartType;
      const [showEditor, setShowEditor] = useState(false);
      const width = props.block.props.width as number;
      const height = props.block.props.height as number;

      const data = props.block.props.data as any;
      const options = props.block.props.options as any;

      const handleJsonChange = (value: string) => {
        try {
          const parsed = JSON.parse(value);
          props.editor.updateBlock(props.block, { props: { data: parsed } });
        } catch {
          // ignore until valid JSON
        }
      };

      return (
        <div className="my-4" contentEditable={false}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <select
                className="text-xs bg-zinc-800 text-white rounded px-2 py-1"
                value={chartType}
                onChange={(e) =>
                  props.editor.updateBlock(props.block, {
                    props: { chartType: e.target.value as any },
                  })
                }
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
              </select>
              <span>
                w:{width}% h:{height}px
              </span>
            </div>
            <div className="flex gap-2">
              <button
                className="text-xs px-2 py-1 rounded bg-zinc-700 text-white hover:bg-zinc-600"
                onClick={() => setShowEditor((v) => !v)}
              >
                {showEditor ? "Preview" : "Edit Data"}
              </button>
            </div>
          </div>

          {showEditor ? (
            <div className="grid grid-cols-1 gap-2">
              <textarea
                className="w-full h-48 bg-zinc-900 text-zinc-100 rounded p-2 font-mono text-xs"
                defaultValue={JSON.stringify(data, null, 2)}
                onChange={(e) => handleJsonChange(e.target.value)}
              />
              <div className="text-xs text-zinc-500">
                Edit Chart.js data JSON (labels, datasets...)
              </div>
            </div>
          ) : (
            <>
              <div
                className="rounded border border-zinc-700 bg-zinc-950 p-3 mx-auto"
                style={{ width: `${width}%`, height }}
              >
                {chartType === "bar" && <Bar data={data} options={options} />}
                {chartType === "line" && <Line data={data} options={options} />}
                {chartType === "pie" && <Pie data={data} options={options} />}
              </div>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Width:</label>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={width}
                    onChange={(e) =>
                      props.editor.updateBlock(props.block, {
                        props: { width: Number(e.target.value) as any },
                      })
                    }
                    className="w-32"
                  />
                  <span className="text-xs text-zinc-500">{width}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Height:</label>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    value={height}
                    onChange={(e) =>
                      props.editor.updateBlock(props.block, {
                        props: { height: Number(e.target.value) as any },
                      })
                    }
                    className="w-32"
                  />
                  <span className="text-xs text-zinc-500">{height}px</span>
                </div>
              </div>
            </>
          )}
        </div>
      );
    },
  }
);
