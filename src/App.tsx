import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Settings, Camera, History as HistoryIcon, Loader2, Trash2, X } from 'lucide-react';
import { ScanData, HistoryItem } from './types/scan';
import { getAllHistory, saveHistoryItem } from './utils/db';
import { exportToPdf, exportHistoryToJson } from './utils/exporters';
import { simulateScan } from './utils/simulator';

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('ACQUIRING TARGET...');
  const [currentScan, setCurrentScan] = useState<ScanData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const [isSimulated, setIsSimulated] = useState(false);

  // Load history on mount
  useEffect(() => {
    getAllHistory().then(setHistory).catch(console.error);
  }, []);

  const handleNewScan = () => {
    setCurrentScan(null);
    setInput('');
    setError(null);
    setViewMode('live');
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { deleteHistoryItem } = await import('./utils/db');
      await deleteHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      if (currentScan && (currentScan as any).id === id) {
        setCurrentScan(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("CONFIRM_DELETION: WIPE ALL ARCHIVAL DATA?")) return;
    try {
      const { clearHistory } = await import('./utils/db');
      await clearHistory();
      setHistory([]);
      setCurrentScan(null);
    } catch (err) {
      console.error("Clear failed:", err);
    }
  };

  const handleScan = async (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    const query = queryOverride || input.trim();
    if (!query || loading) return;

    setInput('');
    setLoading(true);
    setLoadingStatus('ACQUIRING METADATA...');
    setError(null);
    setCurrentScan(null);
    setIsSimulated(false);

    try {
      // === STEP 1: TEXT via Groq ===
      let data: ScanData;

      try {
        setLoadingStatus('CONTACTING GROQ CORE...');
        const groqKey = process.env.GROQ_API_KEY;

        if (!groqKey) throw new Error('NO_GROQ_KEY');

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are SCAN_ARCHIVE v1.0. When given any object, animal, place, food, or concept, respond ONLY with a valid JSON object.

If the target is vague or unclear, return exactly: {"isVague": true}

Otherwise return:
{
  "isVague": false,
  "objectName": "USE THE EXACT USER INPUT IN ALL CAPS WITH UNDERSCORES (e.g. if they say 'cat' return 'CAT', if they say 'golden gate bridge' return 'GOLDEN_GATE_BRIDGE'). DO NOT add prefixes like DOMESTIC_ or COMMON_.",
  "confidence": "97.4%",
  "subjectId": "XX_001_OBJ",
  "classification": "2-3 sentence clinical, factual description.",
  "imagePrompt": "photorealistic image description, well-lit, minimal white background, product photography style",
  "facts": [
    "Historical or origin fact",
    "Surprising or little-known fact",
    "Scientific or physical fact",
    "Cultural or economic fact",
    "Weird or record-breaking fact"
  ],
  "relatedScans": [
    {"timestamp": "2024.03.15 09:41", "objectName": "RELATED_OBJECT_01"},
    {"timestamp": "2024.01.22 14:30", "objectName": "RELATED_OBJECT_02"},
    {"timestamp": "2023.11.08 11:05", "objectName": "RELATED_OBJECT_03"}
  ]
}

Return ONLY the JSON. No markdown, no backticks, no explanation.`
              },
              {
                role: 'user',
                content: `Scan target: ${query}`
              }
            ]
          })
        });

        if (!groqRes.ok) {
          const errBody = await groqRes.text();
          throw new Error(`GROQ_${groqRes.status}: ${errBody}`);
        }

        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content;
        if (!content) throw new Error('GROQ_EMPTY_RESPONSE');

        data = JSON.parse(content) as ScanData;

      } catch (groqErr: any) {
        console.warn('Groq fault, activating simulator:', groqErr.message);
        setLoadingStatus('GROQ_FAULT → ACTIVATING SIMULATOR...');
        data = await simulateScan(query);
        setIsSimulated(true);
      }

      if (data.isVague) {
        setCurrentScan(data);
        setLoading(false);
        return;
      }

      // === STEP 2: SHOW TRIVIA IMMEDIATELY ===
      setCurrentScan(data);
      setLoading(false);

      // === STEP 3: SAVE TO HISTORY ===
      const now = new Date();
      const timestamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const historyId = Date.now().toString();

      const newItem: HistoryItem = {
        id: historyId,
        query: data.objectName || query,
        timestamp,
        data
      };
      await saveHistoryItem(newItem);
      setHistory(prev => [newItem, ...prev]);

      // === STEP 4: IMAGE in background (HF → Pollinations fallback) ===
      if (data.imagePrompt) {
        const imagePrompt = data.imagePrompt;
        (async () => {
          let imageUrl = '';
          try {
            const hfKey = process.env.HF_API_KEY;
            if (!hfKey) throw new Error('NO_HF_KEY');

            const hfRes = await fetch(
              'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hfKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: imagePrompt }),
              }
            );

            if (!hfRes.ok) throw new Error(`HF_STATUS_${hfRes.status}`);

            const blob = await hfRes.blob();
            imageUrl = URL.createObjectURL(blob);

          } catch (hfErr) {
            console.warn('HF fault, falling back to Pollinations:', hfErr);
            const encoded = encodeURIComponent(imagePrompt);
            imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&model=flux&nologo=true`;
          }

          setCurrentScan(prev => prev ? { ...prev, imageUrl } : prev);
        })();
      }

    } catch (err: any) {
      console.error('Critical system error:', err);
      setError(err.message || 'SCAN_ARCHIVE encountered a system error.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-2 md:p-8 flex items-center justify-center font-sans text-black selection:bg-black selection:text-white bg-[radial-gradient(#d5d5d5_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="w-full max-w-[1400px] bg-white border-[3px] border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] h-[95vh] md:h-[90vh]">

        {/* Top Bar */}
        <div className="border-b-[3px] border-black p-3 md:p-4 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="bg-black text-white px-3 py-1 font-black text-sm tracking-tighter">TRDC</div>
            <h1 className="font-bold text-lg md:text-xl tracking-widest uppercase hidden sm:block">SCAN_ARCHIVE_PRO</h1>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-[10px] font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-sm flex items-center gap-1 border border-green-200">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              TRDC_AUTHORIZED
            </div>
            <Maximize className="w-5 h-5 cursor-pointer hover:opacity-70" />
            <Settings className="w-5 h-5 cursor-pointer hover:opacity-70" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* Left Sidebar */}
          <div className="w-full md:w-64 border-b-[3px] md:border-b-0 md:border-r-[3px] border-black flex flex-col bg-white shrink-0">
            <div className="p-4 border-b-[3px] border-black">
              <h2 className="font-bold text-sm">ARCHIVIST_01</h2>
              <p className="text-[10px] text-gray-500 font-mono tracking-wider mt-1">RANK: SENIOR SCANNER</p>
            </div>

            <div className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              SCAN HISTORY
            </div>

            <div
              onClick={() => setViewMode('live')}
              className={`${viewMode === 'live' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'} p-3 flex items-center gap-3 font-bold text-xs tracking-wider cursor-pointer transition-colors`}
            >
              <Camera className="w-4 h-4" /> LIVE VIEW
            </div>
            <div
              onClick={() => setViewMode('history')}
              className={`${viewMode === 'history' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'} p-3 flex items-center gap-3 font-bold text-xs tracking-wider border-b-[3px] border-black cursor-pointer transition-colors`}
            >
              <HistoryIcon className="w-4 h-4" /> HISTORY
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {history.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentScan(item.data || null);
                    setViewMode('live');
                  }}
                  className={`border-[2px] border-black p-2 text-[10px] font-mono uppercase cursor-pointer transition-colors flex justify-between items-center group ${currentScan === item.data ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="opacity-60 mb-1 group-hover:opacity-100">{item.timestamp}</div>
                    <div className="font-bold truncate">{item.query}</div>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteHistory(e, item.id)}
                    className="ml-2 p-1 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-[10px] font-mono text-gray-400 uppercase text-center mt-4">
                  NO PREVIOUS SCANS
                </div>
              )}
            </div>

            <div className="p-4 border-t-[3px] border-black bg-white space-y-2">
              <button
                onClick={handleClearHistory}
                disabled={history.length === 0}
                className="w-full border-[2px] border-black py-2 font-bold text-[9px] tracking-widest hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors uppercase"
              >
                CLEAR_ARCHIVE
              </button>
              <button
                onClick={handleNewScan}
                className="w-full bg-black text-white py-3 font-bold text-xs tracking-widest hover:bg-gray-800 transition-colors"
              >
                NEW_SCAN
              </button>
            </div>

          </div>

          {/* Middle Column */}
          <div className="flex-1 md:border-r-[3px] border-black flex flex-col p-4 md:p-6 relative bg-white min-w-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-4 gap-2">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase">SCANNING_FIELD</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">AUTO_DETECTION_ENABLED // FPS: 60.0</p>
                  {isSimulated && (
                    <span className="text-[8px] bg-yellow-400 text-black font-bold px-1.5 py-0.5 animate-pulse">LOCAL_SIMULATION_ACTIVE</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="bg-black text-white text-[10px] font-bold px-2 py-1 tracking-wider">TARGET_LOCK</span>
                <span className="border-[2px] border-black text-[10px] font-bold px-2 py-1 tracking-wider">OPTICAL_ZOOM_2X</span>
              </div>
            </div>

            <div className="flex-1 border-[3px] border-black relative bg-[#e8e8e8] flex items-center justify-center overflow-hidden group">
              {/* Crosshairs */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-[3px] border-l-[3px] border-black opacity-50"></div>
              <div className="absolute top-6 right-6 w-8 h-8 border-t-[3px] border-r-[3px] border-black opacity-50"></div>
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-[3px] border-l-[3px] border-black opacity-50"></div>
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-[3px] border-r-[3px] border-black opacity-50"></div>

              {/* Center lines */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/10"></div>
              <div className="absolute left-0 right-0 top-1/2 h-px bg-black/10"></div>
              
              {/* Scanline Overlay */}
              <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] animate-pulse"></div>

              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center z-10"
                  >
                    <Loader2 className="w-16 h-16 animate-spin mb-4" />
                    <div className="bg-black text-white px-4 py-2 font-mono text-xs font-bold tracking-widest">
                      {loadingStatus}
                    </div>
                  </motion.div>
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: [0, -10, 10, -10, 10, 0] }}
                    className="bg-white border-[3px] border-black p-4 max-w-sm text-center z-10"
                  >
                    <p className="font-bold text-red-600 mb-2 font-mono">SYSTEM ERROR_FAULT</p>
                    <p className="text-xs font-mono">{error}</p>
                  </motion.div>
                ) : currentScan?.isVague ? (
                  <motion.div
                    key="vague"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: [0, -5, 5, -5, 5, 0] }}
                    className="bg-white border-[3px] border-black p-4 max-w-sm text-center z-10"
                  >
                    <p className="font-bold mb-2 uppercase tracking-tighter">DATA_FRAGMENT_INCOMPLETE</p>
                    <p className="text-xs font-mono text-gray-600">PLEASE SPECIFY TARGET FOR ANALYSIS.</p>
                  </motion.div>
                ) : currentScan?.imageUrl ? (
                  <motion.div
                    key="image"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img src={currentScan.imageUrl} alt={currentScan.objectName} className="w-full h-full object-cover" />

                    {/* Detection Box Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-[2px] border-dashed border-black/50 w-64 h-64 pointer-events-none"></div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-4 py-3 font-mono text-xs font-bold flex flex-col items-center tracking-widest shadow-xl">
                      <span>{currentScan.objectName} DETECTED</span>
                      <span className="text-gray-400 mt-1">[{currentScan.confidence}]</span>
                    </div>
                  </motion.div>
                ) : currentScan ? (
                  <motion.div
                    key="image-pending"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center z-10"
                  >
                    <Loader2 className="w-10 h-10 animate-spin mb-3 opacity-40" />
                    <div className="bg-black text-white px-4 py-2 font-mono text-xs font-bold tracking-widest">
                      {currentScan.objectName} — GENERATING IMAGE...
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-gray-400 font-mono text-sm tracking-widest z-10"
                  >
                    AWAITING TARGET...
                  </motion.div>
                )}
              </AnimatePresence>

              {/* History Overlay */}
              {viewMode === 'history' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-white z-30 flex flex-col p-6 overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl tracking-widest uppercase">ARCHIVE_LOG</h3>
                    <button onClick={() => setViewMode('live')} className="text-[10px] font-bold border-b-2 border-black">CLOSE_ARCHIVE</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {history.map(item => (
                      <div
                        key={item.id}
                        className="border-[3px] border-black p-4 cursor-pointer hover:bg-gray-50 transition-all group relative"
                        onClick={() => { setCurrentScan(item.data || null); setViewMode('live'); }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono opacity-60 group-hover:opacity-100">{item.timestamp}</span>
                          <button 
                            onClick={(e) => handleDeleteHistory(e, item.id)}
                            className="bg-black text-white p-1 hover:bg-red-600 transition-colors z-10"
                            title="DELETE_RECORD"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-lg font-bold uppercase truncate mb-2">{item.query}</div>
                        {item.data?.classification && (
                          <div className="text-[10px] line-clamp-2 opacity-70 group-hover:opacity-100 font-mono">
                            {item.data.classification}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Input Bar */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-20">
                <form onSubmit={handleScan} className="flex shadow-2xl">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="ENTER TARGET..."
                    className="flex-1 bg-white border-[3px] border-black border-r-0 px-4 py-3 font-mono text-xs outline-none uppercase tracking-wider placeholder:text-gray-300"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="bg-black text-white px-6 py-3 font-bold text-xs tracking-widest hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    EXECUTE_SCAN
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column — Trivia Panel */}
          <div className="w-full md:w-[340px] flex flex-col p-4 md:p-6 overflow-y-auto bg-white shrink-0">
            <div className="bg-black text-white p-4 mb-6">
              <h2 className="font-bold text-lg tracking-widest">TRIVIA_DATA</h2>
              <p className="text-[10px] font-mono text-gray-400 mt-1 tracking-widest">
                SUBJECT ID: {currentScan?.subjectId || 'AWAITING_SCAN'}
              </p>
            </div>

            {currentScan && !currentScan.isVague ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-[3px] border-black p-5 flex-1 flex flex-col"
              >
                <div className="bg-black text-white text-[9px] font-bold px-2 py-1 inline-block mb-3 uppercase tracking-widest self-start">
                  CLASSIFICATION
                </div>
                <h3 className="text-3xl font-bold uppercase mb-3 leading-none tracking-tighter break-words">
                  {currentScan.objectName}
                </h3>
                <p className="text-xs text-gray-600 mb-8 leading-relaxed font-medium">
                  {currentScan.classification}
                </p>

                <div className="space-y-6 flex-1">
                  {currentScan.facts?.map((fact, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="border-l-[3px] border-black pl-4 relative"
                    >
                      <div className="absolute -left-[3px] top-0 w-[3px] h-4 bg-black"></div>
                      <h4 className="font-bold text-[10px] mb-1 tracking-widest">FACT_0{i + 1}</h4>
                      <p className="text-xs text-gray-700 leading-relaxed">{fact}</p>
                    </motion.div>
                  ))}
                </div>

                {currentScan.relatedScans && currentScan.relatedScans.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-8 pt-6 border-t-[3px] border-black"
                  >
                    <h4 className="font-bold text-[10px] mb-3 tracking-widest text-gray-500 uppercase">RELATED_LOGS</h4>
                    <div className="space-y-2">
                      {currentScan.relatedScans.map((scan, i) => (
                        <div key={i} className="flex justify-between text-[10px] font-mono">
                          <span className="text-gray-400">{scan.timestamp}</span>
                          <span className="font-bold">{scan.objectName}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="border-[3px] border-black p-5 flex-1 flex items-center justify-center text-gray-300 font-mono text-xs tracking-widest text-center">
                NO DATA AVAILABLE<br />INITIATE SCAN
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => currentScan && !currentScan.isVague && exportToPdf(currentScan)}
                disabled={!currentScan || currentScan.isVague}
                className="flex-1 border-[3px] border-black py-2 text-[10px] font-bold tracking-widest hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                EXPORT_PDF
              </button>
              <button
                onClick={() => history.length > 0 && exportHistoryToJson(history)}
                disabled={history.length === 0}
                className="flex-1 border-[3px] border-black py-2 text-[10px] font-bold tracking-widest hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                LOG_ARCHIVE
              </button>
            </div>

            <div className="mt-4 space-y-1">
              <div className="bg-black text-white text-[9px] font-bold px-3 py-1.5 tracking-widest flex justify-between">
                <span>SIGNAL_INTEGRITY:</span>
                <span className="text-green-400">98.2%</span>
              </div>
              <div className="bg-black text-white text-[9px] font-bold px-3 py-1.5 tracking-widest flex justify-between border-t border-gray-800">
                <span>TEXT_ENGINE:</span>
                <span className="text-blue-400">GROQ // LLAMA-3.3-70B</span>
              </div>
              <div className="bg-black text-white text-[9px] font-bold px-3 py-1.5 tracking-widest flex justify-between border-t border-gray-800">
                <span>IMAGE_ENGINE:</span>
                <span className="text-purple-400">HF // FLUX.1</span>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col gap-1 opacity-20 pointer-events-none">
              <div className="h-0.5 bg-black w-full"></div>
              <div className="h-0.5 bg-black w-[60%]"></div>
              <div className="text-[7px] font-bold text-black uppercase mt-1">TRDC_PROPERTY // DO_NOT_DISTRIBUTE</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}