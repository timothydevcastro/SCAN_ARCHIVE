import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Settings, Camera, History as HistoryIcon, FileText, Archive } from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface RelatedScan {
  timestamp: string;
  objectName: string;
}

interface ScanData {
  isVague: boolean;
  objectName?: string;
  confidence?: string;
  subjectId?: string;
  classification?: string;
  imagePrompt?: string;
  facts?: string[];
  relatedScans?: RelatedScan[];
  imageUrl?: string;
}

interface HistoryItem {
  id: string;
  query: string;
  timestamp: string;
  data?: ScanData;
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState<ScanData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    const query = queryOverride || input.trim();
    if (!query || loading) return;

    setInput('');
    setLoading(true);
    setError(null);
    setCurrentScan(null);

    try {
      // 1. Fetch Text Data
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Scan target: ${query}`,
        config: {
          systemInstruction: `You are SCAN_ARCHIVE v1.0, an AI object scanner with a clean, minimal white UI aesthetic.
When a user inputs any object, animal, place, food, or concept, respond with structured JSON data.

If the target is vague or unclear, set isVague to true.
Otherwise, set isVague to false and provide:
- objectName: The name of the object in ALL CAPS.
- confidence: A random confidence percentage between 94.0% and 99.9%.
- subjectId: A short code like TB_001_OBJ.
- classification: 2-3 sentence description — clean, factual, clinical tone.
- imagePrompt: A clean, photorealistic image generation prompt describing the object clearly. Style: well-lit, minimal background, product/nature photography style. Tone is clinical and archival.
- facts: Exactly 5 facts in this order: 1. Historical/origin, 2. Surprising/little-known, 3. Scientific/design/physical, 4. Cultural/economic, 5. Weird/record-breaking.
- relatedScans: Exactly 3 related past scans, each with a 'timestamp' (e.g., "2023.10.24 14:32") and 'objectName' (e.g., "CERAMIC_MUG_04").`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isVague: { type: Type.BOOLEAN },
              objectName: { type: Type.STRING },
              confidence: { type: Type.STRING },
              subjectId: { type: Type.STRING },
              classification: { type: Type.STRING },
              imagePrompt: { type: Type.STRING },
              facts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              relatedScans: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.STRING },
                    objectName: { type: Type.STRING },
                  },
                  required: ['timestamp', 'objectName'],
                },
              },
            },
            required: ['isVague'],
          },
        },
      });

      const text = textResponse.text;
      if (!text) throw new Error('No response from SCAN_ARCHIVE core.');
      
      const data = JSON.parse(text) as ScanData;

      if (data.isVague) {
        setCurrentScan(data);
        setLoading(false);
        return;
      }

      // 2. Fetch Image Data
      if (data.imagePrompt) {
        try {
          console.log("Generating image for:", data.imagePrompt);
          const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ parts: [{ text: data.imagePrompt }] }],
          });

          const candidates = imageResponse.candidates;
          if (candidates && candidates.length > 0) {
            const parts = candidates[0].content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData) {
                  const mimeType = part.inlineData.mimeType || 'image/png';
                  data.imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                  console.log("Image generated successfully");
                  break;
                }
              }
            }
          }
          
          if (!data.imageUrl) {
            console.warn("No image data found in response parts");
          }
        } catch (imgErr) {
          console.error("Image generation failed:", imgErr);
          // Continue without image if it fails
        }
      }

      setCurrentScan(data);
      
      // Add to history
      const now = new Date();
      const timestamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      setHistory(prev => [{
        id: Date.now().toString(),
        query: data.objectName || query,
        timestamp,
        data
      }, ...prev]);

    } catch (err: any) {
      setError(err.message || 'Scan failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-2 md:p-8 flex items-center justify-center font-sans text-black selection:bg-black selection:text-white bg-[radial-gradient(#d5d5d5_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="w-full max-w-[1400px] bg-white border-[3px] border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] h-[95vh] md:h-[90vh]">
        
        {/* Top Bar */}
        <div className="border-b-[3px] border-black p-3 md:p-4 flex justify-between items-center bg-white z-10">
          <h1 className="font-bold text-lg md:text-xl tracking-widest uppercase">SCAN_ARCHIVE_V1.0</h1>
          <div className="flex gap-4">
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
            
            <div className="bg-black text-white p-3 flex items-center gap-3 font-bold text-xs tracking-wider">
              <Camera className="w-4 h-4" /> LIVE VIEW
            </div>
            <div className="p-3 flex items-center gap-3 font-bold text-xs tracking-wider border-b-[3px] border-black text-gray-500 cursor-pointer hover:bg-gray-50">
              <HistoryIcon className="w-4 h-4" /> HISTORY
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {history.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => setCurrentScan(item.data || null)}
                  className="border-[2px] border-black p-2 text-[10px] font-mono uppercase cursor-pointer hover:bg-black hover:text-white transition-colors bg-white"
                >
                  <div className="opacity-60 mb-1">{item.timestamp}</div>
                  <div className="font-bold truncate">{item.query}</div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-[10px] font-mono text-gray-400 uppercase text-center mt-4">
                  NO PREVIOUS SCANS
                </div>
              )}
            </div>
            
            <div className="p-4 border-t-[3px] border-black bg-white">
              <button 
                onClick={() => { setCurrentScan(null); setInput(''); }}
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
                <p className="text-[10px] font-mono text-gray-500 tracking-widest mt-1">AUTO_DETECTION_ENABLED // FPS: 60.0</p>
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
              
              {/* Center line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/10"></div>
              <div className="absolute left-0 right-0 top-1/2 h-px bg-black/10"></div>

              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center z-10"
                  >
                    <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="bg-black text-white px-4 py-2 font-mono text-xs font-bold tracking-widest">
                      ACQUIRING TARGET...
                    </div>
                  </motion.div>
                ) : error ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="bg-white border-[3px] border-black p-4 max-w-sm text-center z-10"
                  >
                    <p className="font-bold text-red-600 mb-2">SYSTEM ERROR</p>
                    <p className="text-xs font-mono">{error}</p>
                  </motion.div>
                ) : currentScan?.isVague ? (
                  <motion.div 
                    key="vague"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="bg-white border-[3px] border-black p-4 max-w-sm text-center z-10"
                  >
                    <p className="font-bold mb-2">OBJECT UNCLEAR</p>
                    <p className="text-xs font-mono text-gray-600">Please specify target for scanning.</p>
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
          
          {/* Right Column */}
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
                    <div key={i} className="border-l-[3px] border-black pl-4 relative">
                      <div className="absolute -left-[3px] top-0 w-[3px] h-4 bg-black"></div>
                      <h4 className="font-bold text-[10px] mb-1 tracking-widest">FACT_0{i+1}</h4>
                      <p className="text-xs text-gray-700 leading-relaxed">{fact}</p>
                    </div>
                  ))}
                </div>

                {currentScan.relatedScans && currentScan.relatedScans.length > 0 && (
                  <div className="mt-8 pt-6 border-t-[3px] border-black">
                    <h4 className="font-bold text-[10px] mb-3 tracking-widest text-gray-500">RELATED SCANS</h4>
                    <div className="space-y-2">
                      {currentScan.relatedScans.map((scan, i) => (
                        <div key={i} className="flex justify-between text-[10px] font-mono">
                          <span className="text-gray-400">{scan.timestamp}</span>
                          <span className="font-bold">{scan.objectName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="border-[3px] border-black p-5 flex-1 flex items-center justify-center text-gray-300 font-mono text-xs tracking-widest text-center">
                NO DATA AVAILABLE<br/>INITIATE SCAN
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button className="flex-1 border-[3px] border-black py-2 text-[10px] font-bold tracking-widest hover:bg-gray-100 transition-colors">
                EXPORT_PDF
              </button>
              <button className="flex-1 border-[3px] border-black py-2 text-[10px] font-bold tracking-widest hover:bg-gray-100 transition-colors">
                LOG_ARCHIVE
              </button>
            </div>

            <div className="mt-4 space-y-1">
              <div className="bg-black text-white text-[9px] font-bold px-3 py-1.5 tracking-widest flex justify-between">
                <span>SYSTEM_STATUS:</span>
                <span className="text-green-400">OPTIMAL</span>
              </div>
              <div className="bg-black text-white text-[9px] font-bold px-3 py-1.5 tracking-widest flex justify-between">
                <span>NETWORK:</span>
                <span className="text-blue-400">ENCRYPTED</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

