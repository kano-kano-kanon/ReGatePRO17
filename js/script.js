// re_gate ${ver.Pro} JavaScript Code
    // グローバル変数
    // 現在のモード（SELECT, WIRE, 部品名など）
    let currentMode = null; // 現在の操作モード
    let gates = [];         // 画面上の全ゲート情報
    let wires = [];         // 画面上の全配線情報
    let gateId = 0;         // ゲートID管理用
    let wireId = 0;         // 配線ID管理用
    let wireStart = null;   // 配線開始ピン情報
    let selectedGate = null;// 選択中ゲート
    let customGates = {};   // ユーザー定義ゲート情報
    let ver = {Pro: 'Pro16'}; // バージョン情報

        /**
         * 部品名を指定して、キャンバス中央に部品を追加する
         * @param {string} partName 部品名
         */
        function addPart(partName) {
            // 部品追加：正当な部品生成ロジックのみ（冗長なラップ排除）
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            if (GATE_SPECS[partName]) {
                addGate(partName, centerX, centerY);
            } else {
                const status = document.getElementById('status');
                status.textContent = partName + 'は未定義です';
            }
        }
    // Pro8新機能用変数
    let keyStates = {}; // キー押下状態管理
    let activeTimers = new Map(); // タイマーゲートの管理
    let logHistory = new Map(); // ゲートごとのログ履歴
        
        // Pro14新機能: リアルタイム物理シミュレーションエンジン設定
        let physicsEngine = {
            enabled: true, // 物理エンジン有効
            timestep: 1/60, // 60FPS
            propagationDelay: 0.1, // 信号伝播遅延(ns)
            riseTime: 0.05, // 立ち上がり時間(ns)
            fallTime: 0.03, // 立ち下がり時間(ns)
            temperature: 25, // 初期温度(℃)
            voltage: 5.0, // 初期電圧(V)
            fanoutLoading: true, // ファンアウト負荷考慮
            thermalNoise: false, // 熱雑音有効
            powerAnalysis: true, // 消費電力解析
            targetFPS: 60, // シミュレーションFPS
            lastTime: 0, // 前回更新時刻
            running: true, // 自動開始
            detailsVisible: false // 詳細表示状態
        };
        
        let hdlOutput = {
            target: 'verilog', // 'verilog' or 'vhdl'
            style: 'behavioral', // 'behavioral', 'structural', 'rtl'
            clockDomain: 'clk',
            resetStyle: 'async' // 'async' or 'sync'
        };
        
    // 物理特性データ
    let gatePhysics = new Map(); // ゲートごとの物理状態管理
    let signalHistory = new Map(); // 信号履歴（タイミング解析用）
        
        // Pro10 統合版: プリセット機能
        let currentPreset = 'ideal'; // 'ideal', 'standard', 'custom'
        
        // プリセット設定定義
        const PRESET_CONFIGS = {
            'ideal': {
                name: '理想値モード',
                description: '遅延・抵抗・減衰なしの理想的な部品動作',
                icon: '🎓',
                settings: {
                    logicDelay: 0,
                    memoryAccess: 0,
                    resistance: 0,
                    currentLimit: Infinity,
                    driveStrength: 'infinite',
                    brightness: 100,
                    amplitude: 5.0,
                    beta: Infinity,
                    vth: 0,
                    vf: 0
                }
            },
            'standard': {
                name: '業界標準モード',
                description: '実際の電子部品に近い動作特性',
                icon: '⚡',
                settings: {
                    logicDelay: 10,
                    memoryAccess: 15,
                    resistance: 50,
                    currentLimit: 40,
                    driveStrength: 'medium',
                    brightness: 80,
                    amplitude: 3.3,
                    beta: 200,
                    vth: 0.7,
                    vf: 0.7
                }
            },
            'custom': {
                name: 'カスタムモード',
                description: 'ユーザー定義設定',
                icon: '🔧',
                settings: {} // ユーザーが個別設定
            }
        };
        
    // キャンバス・ステータス領域の取得
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
        
        // 統合軽量化ゲート仕様（サイズグループ化）
        const GATE_SIZES = {
            s: { width: 45, height: 50 },      // 小
            m: { width: 55, height: 50 },      // 中
            m3: { width: 50, height: 70 },     // 3入力
            m4: { width: 60, height: 80 },     // 4入力
            l: { width: 80, height: 60 },      // 大
            l8: { width: 80, height: 140 },    // 8入力
            xl: { width: 90, height: 140 },    // XL
            xxl: { width: 100, height: 180 },  // XXL
            w: { width: 80, height: 40 },      // 幅広
            t: { width: 80, height: 80 },      // 正方
            pro8: { width: 90, height: 60 }    // Pro8専用
        };
        
        
        // 軽量化統合ゲート仕様定義
        const GATE_SPECS = {
    // ...既存ゲート定義...
    // 追加部品は分離して定義
    '電流計': { width: 60, height: 40, inputs: 2, outputs: 0, config: { type: 'meter', unit: 'mA' } },
    '電圧計': { width: 60, height: 40, inputs: 2, outputs: 0, config: { type: 'meter', unit: 'V' } },
    '電流元': { width: 60, height: 40, inputs: 0, outputs: 1, config: { type: 'source', unit: 'mA' } },
    'AC電源': { width: 60, height: 40, inputs: 0, outputs: 2, config: { type: 'source', unit: 'V', ac: true } },
    '赤外線送受信': { width: 60, height: 40, inputs: 1, outputs: 1, config: { type: 'ir' } },
    '2pinモータ': { width: 60, height: 40, inputs: 2, outputs: 1, config: { type: 'motor', pins: 2 } },
    '3pin（ICS通信サーボ）': { width: 60, height: 40, inputs: 3, outputs: 1, config: { type: 'servo', pins: 3 } },
    'ステッピングモータ': { width: 60, height: 40, inputs: 4, outputs: 1, config: { type: 'stepper', pins: 4 } },
    'microMotor': { width: 60, height: 40, inputs: 2, outputs: 1, config: { type: 'motor', micro: true } },
    'ヒューズ': { width: 40, height: 20, inputs: 1, outputs: 1, config: { type: 'fuse' } },
    'RGB': { width: 40, height: 40, inputs: 3, outputs: 0, config: { type: 'rgb' } },
    '可変抵抗': { width: 40, height: 20, inputs: 2, outputs: 1, config: { type: 'vr' } },
    'AMアンテナ': { width: 60, height: 20, inputs: 1, outputs: 1, config: { type: 'antenna', band: 'AM' } },
    'FMアンテナ': { width: 60, height: 20, inputs: 1, outputs: 1, config: { type: 'antenna', band: 'FM' } },
    'ダイヤルスイッチ': { width: 40, height: 40, inputs: 1, outputs: 1, config: { type: 'dial' } },
    'ZHコネクタ': { width: 40, height: 20, inputs: 1, outputs: 1, config: { type: 'connector', kind: 'ZH' } },
    'モジュラージャック': { width: 40, height: 20, inputs: 2, outputs: 2, config: { type: 'connector', kind: 'modular' } },
    'microB変換': { width: 40, height: 20, inputs: 1, outputs: 1, config: { type: 'converter', kind: 'microB' } },
    'Li-Poバッテリー': { width: 60, height: 30, inputs: 0, outputs: 2, config: { type: 'battery', chemistry: 'Li-Po', voltage: 3.7 } },
    'Li-Feバッテリー': { width: 60, height: 30, inputs: 0, outputs: 2, config: { type: 'battery', chemistry: 'Li-Fe', voltage: 3.3 } },
    'Li-ionバッテリー': { width: 60, height: 30, inputs: 0, outputs: 2, config: { type: 'battery', chemistry: 'Li-ion', voltage: 3.7 } },
    'マイク': { width: 40, height: 20, inputs: 1, outputs: 1, config: { type: 'mic' } },
    'スピーカ': { width: 40, height: 20, inputs: 1, outputs: 1, config: { type: 'speaker' } },
    'ディスプレイ': { width: 80, height: 40, inputs: 8, outputs: 0, config: { type: 'display' } },
            // 基本ゲート
            'INPUT': { ...GATE_SIZES.s, inputs: 0, outputs: 1 },
            'OUTPUT': { ...GATE_SIZES.s, inputs: 1, outputs: 0 },
            'PUSH_BUTTON': { ...GATE_SIZES.s, inputs: 0, outputs: 1 },
            'TOGGLE_BUTTON': { ...GATE_SIZES.s, inputs: 0, outputs: 1 },
            'DC': { ...GATE_SIZES.s, inputs: 0, outputs: 1 },
            'BUFFER': { ...GATE_SIZES.s, inputs: 1, outputs: 1 },
            'NOT': { ...GATE_SIZES.s, inputs: 1, outputs: 1 },
            'RESISTOR': { ...GATE_SIZES.s, inputs: 1, outputs: 1 },

            // Pro8新機能ゲート
            'KEY_INPUT': { ...GATE_SIZES.pro8, inputs: 0, outputs: 1, config: { key: 'Space', description: 'スペースキー' } },
            'TIMER_PULSE': { ...GATE_SIZES.pro8, inputs: 0, outputs: 1, config: { interval: 1000, enabled: false } },
            'TOGGLE_INPUT': { ...GATE_SIZES.pro8, inputs: 0, outputs: 1, config: { state: false } },
            'COUNTER_GATE': { ...GATE_SIZES.pro8, inputs: 1, outputs: 4, config: { count: 0, max: 15 } },
            'LOG_OUTPUT': { ...GATE_SIZES.pro8, inputs: 1, outputs: 0, config: { maxLines: 10 } },

            // 2入力論理ゲート
            'AND': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            'OR': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            'NAND': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            'NOR': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            'XOR': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            'XNOR': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            
            // 複合ゲート
            'MUX': { ...GATE_SIZES.l, inputs: 3, outputs: 1 },
            'DEMUX': { ...GATE_SIZES.t, inputs: 2, outputs: 4 },
            'ENCODER': { ...GATE_SIZES.t, inputs: 4, outputs: 2 },
            'DECODER': { ...GATE_SIZES.t, inputs: 2, outputs: 4 },
            'MAJORITY': { ...GATE_SIZES.l, inputs: 3, outputs: 1 },
            'PARITY': { ...GATE_SIZES.m, inputs: 2, outputs: 1 },
            
            // 算術回路
            'HALF_ADDER': { ...GATE_SIZES.l, inputs: 2, outputs: 2 },
            'FULL_ADDER': { width: 80, height: 70, inputs: 3, outputs: 2 },
            'BIT4_ADDER': { width: 90, height: 150, inputs: 9, outputs: 5 },
            'COMPLEMENT': { ...GATE_SIZES.t, inputs: 4, outputs: 4 },
            
            // 表示デバイス
            'SEG7': { width: 100, height: 120, inputs: 7, outputs: 0 },
            'BIT4_7SEG': { width: 120, height: 140, inputs: 4, outputs: 0 },
            
            // フリップフロップ
            'D_FF': { ...GATE_SIZES.l, inputs: 2, outputs: 2 },
            'T_FF': { ...GATE_SIZES.l, inputs: 2, outputs: 2 },
            'JK_FF': { width: 80, height: 70, inputs: 3, outputs: 2 },
            'RS_FF': { ...GATE_SIZES.l, inputs: 2, outputs: 2 },
            
            // メモリ・バッファ
            'BIT_MEMORY': { ...GATE_SIZES.l, inputs: 2, outputs: 1 },
            'DELAY': { width: 80, height: 50, inputs: 1, outputs: 1 },
            'BUFFER8': { ...GATE_SIZES.xl, inputs: 8, outputs: 8 },
            
            // Pro7新機能
            'ALU_181': { ...GATE_SIZES.xxl, inputs: 14, outputs: 8 },
            'DIVIDER4': { width: 90, height: 120, inputs: 8, outputs: 8 },
            'MULTIPLIER4': { width: 90, height: 120, inputs: 8, outputs: 8 },
            'MEMORY4': { ...GATE_SIZES.t, inputs: 6, outputs: 4 },
            'MEMORY8': { width: 90, height: 140, inputs: 10, outputs: 8 },
            'DC': { ...GATE_SIZES.s, inputs: 0, outputs: 1 },
            'RESISTOR': { ...GATE_SIZES.s, inputs: 1, outputs: 1 },
            'OSCILLATOR': { ...GATE_SIZES.w, inputs: 1, outputs: 1 },
            'DELAY': { ...GATE_SIZES.w, inputs: 1, outputs: 1 },
            'LED': { ...GATE_SIZES.w, inputs: 1, outputs: 0 },
            'DIODE': { ...GATE_SIZES.w, inputs: 1, outputs: 1 },
            'TRANSISTOR': { ...GATE_SIZES.w, inputs: 2, outputs: 1 },
            'COUNTER': { ...GATE_SIZES.l, inputs: 3, outputs: 4 },
            'REGISTER': { width: 90, height: 120, inputs: 9, outputs: 8 },
            'SHIFTREG': { width: 90, height: 120, inputs: 9, outputs: 8 },
            'LATCH_SR': { ...GATE_SIZES.w, inputs: 2, outputs: 2 },
            'LATCH_D': { ...GATE_SIZES.w, inputs: 2, outputs: 2 },
            'LATCH_T': { ...GATE_SIZES.w, inputs: 2, outputs: 2 },
            'LATCH_JK': { ...GATE_SIZES.w, inputs: 3, outputs: 2 },
            'COMPARATOR': { width: 80, height: 120, inputs: 8, outputs: 3 },
            'ANALOG_SWITCH': { ...GATE_SIZES.w, inputs: 2, outputs: 1 },
            'ANALOG_MUX': { width: 90, height: 140, inputs: 9, outputs: 1 },
            'OSCILLATOR': { ...GATE_SIZES.w, inputs: 1, outputs: 1 },
            'PLL': { ...GATE_SIZES.w, inputs: 2, outputs: 1 },
            'TRANSISTOR': { ...GATE_SIZES.w, inputs: 2, outputs: 1 }
        };
        
        // Pro8新機能：キーボードイベントハンドラ
        document.addEventListener('keydown', function(e) {
            keyStates[e.code] = true;
            keyStates[e.key] = true;
            updateKeyInputGates();
        });
        
        document.addEventListener('keyup', function(e) {
            keyStates[e.code] = false;
            keyStates[e.key] = false;
            updateKeyInputGates();
        });
        
        // Pro8新機能：キー入力ゲートの状態を更新
        function updateKeyInputGates() {
            gates.filter(g => g.type === 'KEY_INPUT').forEach(g => {
                g.value = keyStates[g.config.key] ? 1 : 0;
                g.outputs[0] = g.value;
                updateGateDisplay(g);
            });
        }

        // タイマーゲートの動作開始
        function startTimer(gate) {
            if (activeTimers.has(gate.id)) clearInterval(activeTimers.get(gate.id));
            if (gate.config.enabled) {
                activeTimers.set(gate.id, setInterval(() => {
                    gate.value = gate.value ? 0 : 1;
                    gate.outputs[0] = gate.value;
                    updateGateDisplay(gate);
                }, gate.config.interval));
            }
        }

        // ゲートのログ履歴に値を追加
        function addToLog(gate, value) {
            if (!logHistory.has(gate.id)) logHistory.set(gate.id, []);
            const log = logHistory.get(gate.id);
            log.push(`${new Date().toLocaleTimeString()}: ${value}`);
            if (log.length > (gate.config.maxLines || 10)) log.shift();
            updateLogDisplay(gate);
        }

        // ゲートのログ表示を更新
        function updateLogDisplay(gate) {
            if (!gate.logElement) {
                gate.logElement = document.createElement('div');
                gate.logElement.className = 'log-display';
                gate.logElement.style.cssText = 'position:absolute;background:rgba(0,0,0,0.8);color:white;padding:5px;border-radius:4px;font-family:monospace;font-size:8px;max-width:150px;max-height:80px;overflow-y:auto;z-index:100;top:-85px;left:0px;';
                gate.element.appendChild(gate.logElement);
            }
            const log = logHistory.get(gate.id) || [];
            gate.logElement.innerHTML = log.join('<br>');
            gate.logElement.style.display = log.length > 0 ? 'block' : 'none';
        }

        // 物理シミュレーションエンジン初期化
        function initPhysicsEngine() {
            // タイムステップベースの物理エンジン初期化
            physicsEngine.lastTime = performance.now();
            physicsEngine.running = true;
            // 各ゲートの物理属性初期化
            gates.forEach(gate => {
                if (!gatePhysics.has(gate.id)) {
                    gatePhysics.set(gate.id, {
                        temperature: physicsEngine.temperature,
                        voltage: physicsEngine.voltage,
                        power: calculateGatePower(gate),
                        thermalNoise: 0,
                        propagationDelay: physicsEngine.propagationDelay,
                        riseTime: physicsEngine.riseTime,
                        fallTime: physicsEngine.fallTime,
                        fanoutLoad: calculateFanoutLoad(gate)
                    });
                }
            });
            // 物理シミュレーションタイマー開始
            setInterval(updatePhysics, 1000 / physicsEngine.targetFPS);
        }

        // 物理エンジンの状態更新（毎フレーム呼び出し）
        function updatePhysics() {
            if (!physicsEngine.running) return;
            const currentTime = performance.now();
            const deltaTime = currentTime - physicsEngine.lastTime;
            physicsEngine.lastTime = currentTime;
            // 全ゲートの物理状態更新
            gates.forEach(gate => {
                updateGatePhysics(gate, deltaTime);
            });
            // 信号伝播の物理計算
            updateSignalPropagation();
            // 熱力学的効果計算
            updateThermalEffects();
        }

        // ゲートごとの物理状態を更新
        function updateGatePhysics(gate, deltaTime) {
            const physics = gatePhysics.get(gate.id);
            if (!physics) return;
            const oldPower = physics.power;
            const oldTemp = physics.temperature;
            // 消費電力計算
            physics.power = calculateGatePower(gate);
            // 温度影響による遅延変化
            const tempFactor = 1 + (physics.temperature - 25) * 0.002; // 25℃基準
            physics.propagationDelay = physicsEngine.propagationDelay * tempFactor;
            // 電圧影響による速度変化
            const voltageFactor = Math.pow(physics.voltage / physicsEngine.voltage, 1.3);
            physics.propagationDelay /= voltageFactor;
            // ファンアウト負荷による遅延増加
            physics.propagationDelay *= (1 + physics.fanoutLoad * 0.1);
            // 熱雑音計算
            physics.thermalNoise = Math.sqrt(4 * 1.38e-23 * physics.temperature * 1e6) * Math.random();
            // 異常検出とログ記録
            if (Math.abs(physics.power - oldPower) > oldPower * 0.1) {
                addPhysicsLogEntry(`ゲート${gate.id}: 消費電力変化 ${(oldPower*1000).toFixed(1)}→${(physics.power*1000).toFixed(1)}mW`);
            }
            if (Math.abs(physics.temperature - oldTemp) > 5) {
                addPhysicsLogEntry(`ゲート${gate.id}: 温度変化 ${oldTemp.toFixed(1)}→${physics.temperature.toFixed(1)}°C`);
            }
            if (physics.temperature > 80) {
                addPhysicsLogEntry(`⚠️ ゲート${gate.id}: 高温警告 ${physics.temperature.toFixed(1)}°C`);
            }
            // 信号履歴記録
            recordSignalHistory(gate, deltaTime);
        }

        function calculateGatePower(gate) {
            let power = 0;
            const baseCurrents = {
                'AND': 2e-6, 'OR': 2e-6, 'NOT': 1e-6, 'NAND': 2e-6, 'NOR': 2e-6,
                'XOR': 4e-6, 'BUFFER': 1e-6, 'CLOCK': 10e-6, 'MEMORY': 50e-6,
                'FLIPFLOP': 20e-6, 'COUNTER': 100e-6, 'REGISTER': 80e-6
            };
            
            const baseCurrent = baseCurrents[gate.type] || 5e-6;
            const physics = gatePhysics.get(gate.id);
            const voltage = physics ? physics.voltage : physicsEngine.voltage;
            
            // 静的消費電力
            power += baseCurrent * voltage;
            
            // 動的消費電力（スイッチング）
            if (gate.lastSwitchTime && (Date.now() - gate.lastSwitchTime) < 100) {
                power += baseCurrent * voltage * 10; // スイッチング時は10倍
            }
            
            return power;
        }

        function calculateFanoutLoad(gate) {
            let fanout = 0;
            gate.outputs.forEach((_, outputIndex) => {
                connections.forEach(conn => {
                    if (conn.from.gate === gate && conn.from.pin === outputIndex) {
                        fanout++;
                    }
                });
            });
            return fanout;
        }

        function updateSignalPropagation() {
            // 信号伝播処理：接続情報をもとに各ゲートへ信号を伝播
            connections.forEach(conn => {
                const sourceGate = conn.from.gate;
                const targetGate = conn.to.gate;
                const sourcePhysics = gatePhysics.get(sourceGate.id);
                // 伝播遅延を考慮した信号更新
                if (sourcePhysics) {
                    setTimeout(() => {
                        const sourceValue = sourceGate.outputs[conn.from.pin];
                        if (targetGate.inputs[conn.to.pin] !== sourceValue) {
                            targetGate.inputs[conn.to.pin] = sourceValue;
                            targetGate.lastSwitchTime = Date.now();
                            updateGateLogic(targetGate);
                        }
                    }, sourcePhysics.propagationDelay * 1000);
                }
            });
        }

        function updateThermalEffects() {
            // 熱効果処理：消費電力による温度上昇と放熱による冷却
            gates.forEach(gate => {
                const physics = gatePhysics.get(gate.id);
                if (!physics) return;
                // 熱生成（電力に比例）
                const heatGenerated = physics.power * 1000; // W to mW
                // 熱放散（周囲温度差に比例）
                const heatDissipated = (physics.temperature - 25) * 0.1;
                // 温度更新
                physics.temperature += (heatGenerated - heatDissipated) * 0.001;
                // 温度制限
                physics.temperature = Math.max(0, Math.min(150, physics.temperature));
            });
        }

        function recordSignalHistory(gate, deltaTime) {
            // 信号履歴記録：ゲートごとの入力・出力・物理状態を保存
            const gateId = gate.id;
            if (!signalHistory.has(gateId)) {
                signalHistory.set(gateId, []);
            }
            const history = signalHistory.get(gateId);
            const timestamp = performance.now();
            // 入力と出力の状態記録
            history.push({
                time: timestamp,
                inputs: [...gate.inputs],
                outputs: [...gate.outputs],
                power: gatePhysics.get(gateId)?.power || 0,
                temperature: gatePhysics.get(gateId)?.temperature || 25
            });
            // 履歴サイズ制限（最新1000エントリ）
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }
        }

        function updateGateLogic(gate) {
            // 部品タイプごとに分岐できる基礎枠
            switch (gate.type) {
                case '電流計': {
                    let current = gate.inputs?.reduce((a, b) => a + b, 0) || 0;
                    gate.value = current;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `I=${current}mA`;
                    break;
                }
                case '電圧計': {
                    let voltage = gate.inputs?.[0] || 0;
                    gate.value = voltage;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `V=${voltage}V`;
                    break;
                }
                case '電流元': {
                    gate.value = gate.inputs?.[0] || 0;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `I元:${gate.value}`;
                    break;
                }
                case 'AC電源': {
                    gate.value = gate.inputs?.[0] || 0;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `AC:${gate.value}`;
                    break;
                }
                case '赤外線送受信': {
                    gate.value = gate.inputs?.[0] || 0;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `IR:${gate.value}`;
                    break;
                }
                case '2pinモータ': {
                    let speed = gate.inputs?.[0] || 0;
                    gate.value = speed;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `回転:${speed}`;
                    break;
                }
                case '3pin（ICS通信サーボ）': {
                    let pos = gate.inputs?.[0] || 0;
                    gate.value = pos;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `サーボ:${pos}`;
                    break;
                }
                case 'ステッピングモータ': {
                    let step = gate.inputs?.[0] || 0;
                    gate.value = step;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `ステップ:${step}`;
                    break;
                }
                case 'microMotor': {
                    let micro = gate.inputs?.[0] || 0;
                    gate.value = micro;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `micro:${micro}`;
                    break;
                }
                case 'ヒューズ': {
                    let fuseState = (gate.inputs?.[0] > 10) ? '断線' : '正常';
                    gate.value = fuseState;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `ヒューズ:${fuseState}`;
                    break;
                }
                case 'RGB': {
                    let color = 'rgb(0,0,0)';
                    if (gate.inputs?.length >= 3) color = `rgb(${gate.inputs[0]},${gate.inputs[1]},${gate.inputs[2]})`;
                    if (gate.element) {
                        gate.element.style.background = color;
                        gate.element.querySelector('.gate-text').textContent = 'RGB';
                    }
                    break;
                }
                case '可変抵抗': {
                    let res = gate.inputs?.[0] || 0;
                    gate.value = res;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `抵抗:${res}`;
                    break;
                }
                case 'AMアンテナ': {
                    let am = gate.inputs?.[0] || 0;
                    gate.value = am;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `AM:${am}`;
                    break;
                }
                case 'FMアンテナ': {
                    let fm = gate.inputs?.[0] || 0;
                    gate.value = fm;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `FM:${fm}`;
                    break;
                }
                case 'ダイヤルスイッチ': {
                    let dial = gate.inputs?.[0] || 0;
                    gate.value = dial;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `ダイヤル:${dial}`;
                    break;
                }
                case 'ZHコネクタ': {
                    let zh = gate.inputs?.[0] || 0;
                    gate.value = zh;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `ZH:${zh}`;
                    break;
                }
                case 'モジュラージャック': {
                    let jack = gate.inputs?.[0] || 0;
                    gate.value = jack;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `ジャック:${jack}`;
                    break;
                }
                case 'microB変換': {
                    let microB = gate.inputs?.[0] || 0;
                    gate.value = microB;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `microB:${microB}`;
                    break;
                }
                case 'Li-Poバッテリー':
                case 'Li-Feバッテリー':
                case 'Li-ionバッテリー': {
                    if (gate.value === undefined) gate.value = 100;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `残量:${gate.value}%`;
                    break;
                }
                case 'マイク': {
                    let mic = gate.inputs?.[0] || 0;
                    gate.value = mic;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `Mic:${mic}`;
                    break;
                }
                case 'スピーカ': {
                    let spk = gate.inputs?.[0] || 0;
                    gate.value = spk;
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = `Spk:${spk}`;
                    break;
                }
                case 'ディスプレイ': {
                    let disp = gate.inputs?.join(',') || '';
                    if (gate.element) gate.element.querySelector('.gate-text').textContent = disp;
                    break;
                }
                default: {
                    // 既存のゲートロジック更新に物理効果を適用（絶対に消さない）
                    const physics = gatePhysics.get(gate.id);
                    if (physics && physics.thermalNoise > 0.001) {
                        if (Math.random() < physics.thermalNoise * 1e6) {
                            gate.outputs.forEach((_, i) => {
                                gate.outputs[i] = Math.random() > 0.5 ? 1 : 0;
                            });
                            return;
                        }
                    }
                    // 通常のゲートロジック実行（絶対に消さない）
                    executeGateLogic(gate);
                    break;
                }
            }
        }

        function executeGateLogic(gate) {
            // 基本的なゲートロジック実装
            switch (gate.type) {
                case 'AND':
                    gate.outputs[0] = gate.inputs.every(i => i === 1) ? 1 : 0;
                    break;
                case 'OR':
                    gate.outputs[0] = gate.inputs.some(i => i === 1) ? 1 : 0;
                    break;
                case 'NOT':
                    gate.outputs[0] = gate.inputs[0] === 1 ? 0 : 1;
                    break;
                case 'NAND':
                    gate.outputs[0] = gate.inputs.every(i => i === 1) ? 0 : 1;
                    break;
                case 'NOR':
                    gate.outputs[0] = gate.inputs.some(i => i === 1) ? 0 : 1;
                    break;
                case 'XOR':
                    gate.outputs[0] = gate.inputs.filter(i => i === 1).length % 2;
                    break;
                default:
                    // その他のゲート種類の処理
                    break;
            }
            
            updateGateDisplay(gate);
        }
        
        // モード設定
    // 操作モード切替
    function setMode(mode) {
            currentMode = mode;
            
            // ボタンの状態更新
            document.querySelectorAll('.gate-button').forEach(btn => {
                btn.classList.remove('active');
            });
            if (event && event.target) {
                event.target.classList.add('active');
            }
            
            // ツールバーボタンリセット
            document.querySelectorAll('.toolbar button').forEach(btn => {
                btn.style.background = '';
                btn.style.color = '';
            });
            
            if (mode === 'WIRE') {
                status.textContent = '配線モード: 出力ピン（青）から入力ピン（赤）の順でクリックしてください';
                canvas.style.cursor = 'crosshair';
                // 配線ボタンをアクティブに
                document.querySelectorAll('.toolbar button').forEach(btn => {
                    if (btn.textContent.includes('配線') || btn.textContent.includes('🔗')) {
                        btn.style.background = '#007bff';
                        btn.style.color = 'white';
                    }
                });
            } else if (mode === 'SELECT') {
                status.textContent = '選択モード: ゲートをクリックして設定や選択を行います';
                canvas.style.cursor = 'pointer';
                // 選択ボタンをアクティブに
                document.querySelectorAll('.toolbar button').forEach(btn => {
                    if (btn.textContent.includes('選択') || btn.textContent.includes('🖱️')) {
                        btn.style.background = '#28a745';
                        btn.style.color = 'white';
                    }
                });
            } else {
                status.textContent = `${mode}ゲートを配置するためにキャンバスをクリックしてください`;
                canvas.style.cursor = 'crosshair';
            }
            
            wireStart = null;
        }
        
        // キャンバスクリックイベント
        // モードに応じて配線・選択・部品追加を切り替え
        canvas.addEventListener('click', function(e) {
            if (!currentMode) return;
            
            if (currentMode === 'WIRE') {
                handleWireClick(e); // 配線処理
            } else if (currentMode === 'SELECT') {
                handleSelectClick(e); // ゲート選択処理
            } else {
                addGate(currentMode, e.offsetX, e.offsetY); // 部品追加
            }
        });
        
        // ゲート追加処理
        // 指定した部品タイプ・座標でゲートを生成し、画面に追加
        function addGate(type, x, y) {
            // 部品追加・生成：部品仕様を取得し、物理・表示・ピン・イベントを統合
            const spec = GATE_SPECS[type];
            if (!spec) {
                console.error('Unknown gate type:', type);
                return;
            }
            // 部品ごとの初期値・物理特性・configを設定
            const gate = {
                id: gateId++,
                type: type,
                x: x - spec.width / 2,
                y: y - spec.height / 2,
                width: spec.width,
                height: spec.height,
                value: spec.config?.initValue ?? 0,
                userValue: null,
                inputs: new Array(spec.inputs).fill(0),
                outputs: new Array(spec.outputs).fill(0),
                inputConnections: new Array(spec.inputs).fill(null),
                element: null,
                isPushed: false,
                displayData: null,
                memoryData: null,
                oscillatorState: false,
                counterValue: 0,
                lastClk: 0,
                config: spec.config ? {...spec.config} : {},
                lastLogValue: undefined
            };
            // 物理特性初期化
            gatePhysics.set(gate.id, {
                voltage: spec.config?.voltage ?? physicsEngine.voltage,
                temperature: physicsEngine.temperature,
                resistance: spec.config?.resistance ?? 0,
                current: 0,
                propagationDelay: physicsEngine.propagationDelay,
                riseTime: physicsEngine.riseTime,
                fallTime: physicsEngine.fallTime,
                thermalNoise: physicsEngine.thermalNoise
            });
            // DOM要素作成・表示・ピン・イベントを統合
            let gateEl = document.createElement('div');
            gateEl.className = `gate ${getGateClass(type)}`;
            Object.assign(gateEl.style, {
                left: gate.x + 'px',
                top: gate.y + 'px',
                width: spec.width + 'px',
                height: spec.height + 'px'
            });
            gateEl.dataset.gateId = gate.id;
            // ゲート名表示
            let textSpan = document.createElement('span');
            textSpan.className = 'gate-text';
            Object.assign(textSpan.style, {
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', pointerEvents: 'none',
                fontSize: '10px', fontWeight: 'bold', zIndex: '1'
            });
            textSpan.textContent = getGateDisplayText(gate);
            gateEl.appendChild(textSpan);
            // 表示デバイス・ピン・イベントを一括生成
            createDisplayElements(gate, gateEl);
            addPins(gate, gateEl, spec);
            setupGateEvents(gate, gateEl);
            // 画面に追加
            canvas.appendChild(gateEl);
            gate.element = gateEl;
            gates.push(gate);
            status.textContent = `${type}部品を追加しました (ID: ${gate.id})`;
        }
        
        
        // 統合ピン追加関数
        function addPins(gate, gateEl, spec) {
            const createPin = (type, index, spacing, startY) => {
                const pin = document.createElement('div');
                pin.className = `pin ${type}-pin`;
                Object.assign(pin.style, { 
                    top: (startY + index * spacing - 4) + 'px',
                    pointerEvents: 'auto',
                    zIndex: '1000',
                    cursor: 'pointer'
                });
                Object.assign(pin.dataset, {
                    gateId: gate.id,
                    pinType: type,
                    pinIndex: index
                });
                
                // 直接イベントハンドラーを追加
                pin.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // 配線モードに関係なくピンクリックを処理
                    if (currentMode === 'WIRE') {
                        handlePinClick(gate, pin, e);
                    } else {
                        // 配線モードでない場合は自動的に配線モードに切り替え
                        setMode('WIRE');
                        setTimeout(() => {
                            handlePinClick(gate, pin, e);
                        }, 50);
                    }
                }, true); // キャプチャフェーズで実行
                
                gateEl.appendChild(pin);
                
                // ラベル作成
                const label = getPinLabel(gate.type, type, index);
                if (label) {
                    const labelEl = document.createElement('div');
                    labelEl.className = `pin-label ${type}-label`;
                    labelEl.style.top = (startY + index * spacing) + 'px';
                    labelEl.textContent = label;
                    gateEl.appendChild(labelEl);
                }
            };
            
            // 入力ピン一括処理
            if (spec.inputs > 0) {
                const spacing = Math.max(12, Math.min(15, (spec.height - 20) / spec.inputs));
                const startY = (spec.height - (spec.inputs - 1) * spacing) / 2;
                for (let i = 0; i < spec.inputs; i++) createPin('input', i, spacing, startY);
            }
            
            // 出力ピン一括処理
            if (spec.outputs > 0) {
                const spacing = Math.max(12, Math.min(15, (spec.height - 20) / spec.outputs));
                const startY = (spec.height - (spec.outputs - 1) * spacing) / 2;
                for (let i = 0; i < spec.outputs; i++) createPin('output', i, spacing, startY);
            }
        }
        
    // ゲートクラス名取得：部品種別ごとにCSSクラスを返す
    function getGateClass(type) {
            const classMap = {
                'INPUT': 'IN', 'PUSH_BUTTON': 'PUSH', 'TOGGLE_BUTTON': 'TOGGLE', 'DC': 'DC',
                'OUTPUT': 'OUT', 'NOT': 'NOT', 'LED': 'LED', 'DELAY': 'DELAY',
                'BIT_MEMORY': 'MEM', 'MAJORITY': 'MAJOR', 'PARITY': 'PARI',
                'LATCH_SR': 'SR-LATCH', 'LATCH_D': 'D-LATCH', 'LATCH_T': 'T-LATCH',
                'LATCH_JK': 'JK-LATCH', 'BIT4_MEMORY': '4bit-MEM',
                'BIT8_MEMORY': '8bit-MEM', '4bit-REGISTER': '4bit_REGIS',
                'BIT8_REGISTER': '8bit-REGISTER',
                'BUFFER': 'BUF', 'BUFFER8': '8inBUF',
                'AND': 'AND', 'BIT4_ADDER': '4bit-ADD', 'REGISTER': 'REGIS',
                'OR': 'OR', 'DECODER': 'DECODER',
                'NAND': 'NAND', 'COMPARATOR': 'COMPARA',
                'NOR': 'NOR', 'COUNTER': 'COUNT',
                'MUX': 'MUX', 'ENCODER': 'ENCO', 'HALF_ADDER': 'HA', 'FULL_ADDER': 'FA',
                'D_FF': 'D-FF', 'T_FF': 'T-FF', 'JK_FF': 'JK-FF', 'RS_FF': 'RS-FF',
                'COMPLEMENT': 'COMPLE', 'SEG7': '7seg', 'BIT4_7SEG': '4bit7seg',
                'ALU_181': '74HC181', 'DIVIDER4': 'divi', 'MULTIPLIER4': 'multi',
                'MEMORY4': 'memory4', 'MEMORY8': 'memory8', 'DC': 'dc', 'RESISTOR': 'resistor',
                'OSCILLATOR': 'oscillator', 'DELAY': 'delay', 'DIODE': 'diode',
                'SHIFTREG': 'shiftreg', 'ANALOG_SWITCH': 'analog_switch', 'ANALOG_MUX': 'analog_mux',
                'OSCILLATOR': 'oscillator', 'PLL': 'PLL', 'TRANSISTOR': 'trans'
            };
            
            // 多入力ゲート
            if (type.includes('AND') || type.includes('OR') || type.includes('NAND') || type.includes('NOR')) {
                return 'multi_input';
            }
            if (type.includes('XOR')) return 'xor';
            if (type.includes('XNOR')) return 'xnor';
            if (type.includes('LATCH_')) return 'latch';
            
            // カスタムゲート
            if (type.startsWith('CUSTOM_')) return 'custom';
            
            return classMap[type] || type.toLowerCase();
        }
        
        
        // 統合ピンラベルマップ（軽量化）
        const PIN_LABELS = {
            'HALF_ADDER': { input: ['A', 'B'], output: ['S', 'C'] },
            'FULL_ADDER': { input: ['A', 'B', 'Cin'], output: ['S', 'Cout'] },
            'BIT4_ADDER': { 
                input: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Cin'],
                output: ['S0', 'S1', 'S2', 'S3', 'Cout']
            },
            'COMPLEMENT': { input: ['D0', 'D1', 'D2', 'D3'], output: ['Q0', 'Q1', 'Q2', 'Q3'] },
            'SEG7': { input: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
            'BIT4_7SEG': { input: ['D0', 'D1', 'D2', 'D3'] },
            'D_FF': { input: ['D', 'CLK'], output: ['Q', 'Q̄'] },
            'T_FF': { input: ['T', 'CLK'], output: ['Q', 'Q̄'] },
            'JK_FF': { input: ['J', 'K', 'CLK'], output: ['Q', 'Q̄'] },
            'RS_FF': { input: ['R', 'S'], output: ['Q', 'Q̄'] },
            'MUX': { input: ['A', 'B', 'SEL'], output: ['Y'] },
            'DEMUX': { input: ['IN', 'SEL'], output: ['Y0', 'Y1', 'Y2', 'Y3'] },
            'DECODER': { input: ['A', 'B'], output: ['Y0', 'Y1', 'Y2', 'Y3'] },
            'ENCODER': { input: ['D0', 'D1', 'D2', 'D3'], output: ['A', 'B'] },
            'BUFFER8': {
                input: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
                output: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']
            },
            'ALU_181': {
                input: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'S0', 'S1', 'S2', 'S3', 'Cin', 'M'],
                output: ['F0', 'F1', 'F2', 'F3', 'A=B', 'Cout', 'P', 'G']
            },
            'DIVIDER4': {
                input: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'],
                output: ['Q0', 'Q1', 'Q2', 'Q3', 'R0', 'R1', 'R2', 'R3']
            },
            'MULTIPLIER4': {
                input: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'],
                output: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']
            },
            'MEMORY4': { input: ['D0', 'D1', 'D2', 'D3', 'A0', 'WE'], output: ['Q0', 'Q1', 'Q2', 'Q3'] },
            'MEMORY8': {
                input: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A0', 'WE'],
                output: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']
            },
            'COUNTER': { input: ['CLK', 'RST', 'EN'], output: ['Q0', 'Q1', 'Q2', 'Q3'] },
            'REGISTER': {
                input: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'CLK'],
                output: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']
            },
            'SHIFTREG': {
                input: ['SI', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'CLK'],
                output: ['SO', 'Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']
            },
            'LATCH_SR': { input: ['S', 'R'], output: ['Q', 'Q̄'] },
            'LATCH_D': { input: ['D', 'EN'], output: ['Q', 'Q̄'] },
            'LATCH_T': { input: ['T', 'EN'], output: ['Q', 'Q̄'] },
            'LATCH_JK': { input: ['J', 'K', 'EN'], output: ['Q', 'Q̄'] },
            'COMPARATOR': {
                input: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'],
                output: ['A>B', 'A=B', 'A<B']
            },
            'ANALOG_SWITCH': { input: ['IN', 'CTRL'], output: ['OUT'] },
            'ANALOG_MUX': {
                input: ['I0', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'SEL'],
                output: ['OUT']
            },
            'OSCILLATOR': { input: ['EN'], output: ['OUT'] },
            'PLL': { input: ['REF', 'VCO'], output: ['OUT'] },
            'TRANSISTOR': { input: ['B', 'E'], output: ['C'] }
        };
        
    // ピンラベル取得：部品種別・ピン種別・インデックスからラベルを返す
    function getPinLabel(gateType, pinType, pinIndex) {
            const labels = PIN_LABELS[gateType];
            return labels && labels[pinType] && labels[pinType][pinIndex] ? labels[pinType][pinIndex] : null;
        }
        
    // カスタムゲート作成：UI入力からカスタム論理ゲートを生成
    function createCustomGate() {
            showConfigDialog('カスタムゲート作成', `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 300;">カスタムゲート</h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">独自の論理ゲートを作成しましょう</p>
                </div>
                
                <div style="display: grid; gap: 20px; padding: 5px; padding-bottom: 30px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #007bff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057; font-size: 14px;">ゲート名</label>
                        <input type="text" id="gateName" placeholder="例: MyGate" maxlength="20" 
                               style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: border-color 0.3s; background: white;"
                               onfocus="this.style.borderColor='#007bff'" onblur="this.style.borderColor='#dee2e6'">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: #e8f5e8; padding: 15px; border-radius: 10px; border-left: 4px solid #28a745;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #155724; font-size: 14px;">📥 入力数</label>
                            <input type="number" id="inputCount" min="1" max="8" value="2" 
                                   style="width: 100%; padding: 10px; border: 2px solid #c3e6cb; border-radius: 6px; font-size: 14px; background: white;">
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 10px; border-left: 4px solid #ffc107;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #856404; font-size: 14px;">📤 出力数</label>
                            <input type="number" id="outputCount" min="1" max="8" value="1" 
                                   style="width: 100%; padding: 10px; border: 2px solid #ffeaa7; border-radius: 6px; font-size: 14px; background: white;">
                        </div>
                    </div>
                    
                    <div style="background: #f3e5f5; padding: 20px; border-radius: 10px; border-left: 4px solid #6f42c1;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #493057; font-size: 14px;">論理式</label>
                        <textarea id="logicFormula" placeholder="例: OUT0 = IN0 & IN1" rows="4" 
                                  style="width: 100%; padding: 12px; border: 2px solid #e1bee7; border-radius: 8px; font-size: 14px; font-family: 'Courier New', monospace; background: white; resize: vertical;"
                                  onfocus="this.style.borderColor='#6f42c1'" onblur="this.style.borderColor='#e1bee7'"></textarea>
                        <div style="background: rgba(111, 66, 193, 0.1); padding: 10px; border-radius: 6px; margin-top: 10px;">
                            <small style="color: #6f42c1; font-weight: 500; line-height: 1.4;">
                                💡 <strong>使用可能な記法:</strong><br>
                                • 入力: IN0～IN7 &nbsp;&nbsp; • 出力: OUT0～OUT7<br>
                                • 演算子: &(AND), |(OR), ^(XOR), !(NOT)
                            </small>
                        </div>
                    </div>
                </div>
            `, function() {
                const name = document.getElementById('gateName').value.trim();
                const inputs = parseInt(document.getElementById('inputCount').value);
                const outputs = parseInt(document.getElementById('outputCount').value);
                const logic = document.getElementById('logicFormula').value.trim();
                
                if (!name) {
                    alert('ゲート名を入力してください');
                    return false;
                }
                
                if (inputs < 1 || inputs > 8 || outputs < 1 || outputs > 8) {
                    alert('入力数・出力数は1-8の範囲で入力してください');
                    return false;
                }
                
                if (!logic) {
                    alert('論理式を入力してください');
                    return false;
                }
                
                // カスタムゲート定義
                const customType = `CUSTOM_${name.toUpperCase()}`;
                customGates[customType] = {
                    name: name,
                    logic: logic,
                    evaluate: new Function('inputs', `
                        let outputs = new Array(${outputs}).fill(0);
                        try {
                            ${logic.replace(/IN(\d+)/g, 'inputs[$1]').replace(/OUT(\d+)/g, 'outputs[$1]')}
                        } catch(e) {
                            console.error('カスタムゲート評価エラー:', e);
                        }
                        return outputs;
                    `)
                };
                
                GATE_SPECS[customType] = {
                    inputs: inputs,
                    outputs: outputs,
                    width: Math.max(60, name.length * 8),
                    height: Math.max(40, Math.max(inputs, outputs) * 15 + 20)
                };
                
                // UIに追加
                updateCustomGatesList();
                status.textContent = `カスタムゲート "${name}" を作成しました`;
                return true;
            });
        }
        
    // カスタムゲートリスト更新：UIリストを最新状態に反映
    function updateCustomGatesList() {
            const list = document.getElementById('customGatesList');
            list.innerHTML = '';
            
            Object.keys(customGates).forEach(type => {
                const gate = customGates[type];
                const btn = document.createElement('button');
                btn.className = 'gate-button';
                btn.textContent = gate.name;
                btn.onclick = () => setMode(type);
                btn.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (confirm(`"${gate.name}"を削除しますか？`)) {
                        delete customGates[type];
                        delete GATE_SPECS[type];
                        updateCustomGatesList();
                    }
                };
                list.appendChild(btn);
            });
        }
        
        
    // 表示要素作成：ゲート種別ごとに表示デバイスを生成
    function createDisplayElements(gate, gateEl) {
            if (gate.type === 'SEG7' || gate.type === 'BIT4_7SEG') {
                const display = document.createElement('div');
                display.className = 'seg7-display';
                Object.assign(display.style, {
                    position: 'absolute', right: '10px', top: '30px',
                    width: '40px', height: '60px', fontSize: '24px',
                    fontWeight: 'bold', fontFamily: 'monospace',
                    background: '#000', color: '#0f0', textAlign: 'center',
                    lineHeight: '60px', border: '2px solid #333',
                    borderRadius: '4px'
                });
                display.textContent = '0';
                gateEl.appendChild(display);
                gate.displayElement = display;
            }
            
            if (gate.type === 'LED') {
                const led = document.createElement('div');
                Object.assign(led.style, {
                    position: 'absolute', top: '5px', left: '5px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#333', border: '2px solid #666'
                });
                gate.ledElement = led;
                gateEl.appendChild(led);
            }
        }
        
        
        // 統合ゲート表示テキスト取得
        function getGateDisplayText(gate) {
            // Pro8新機能ゲートの表示処理
            if (gate.type === 'KEY_INPUT') {
                return `${gate.config.description || gate.config.key}`;
            }
            if (gate.type === 'TIMER_PULSE') {
                return `${gate.config.interval}ms`;
            }
            if (gate.type === 'TOGGLE_INPUT') {
                return `${gate.config.state ? 'ON' : 'OFF'}`;
            }
            if (gate.type === 'COUNTER_GATE') {
                return `${gate.config.count}`;
            }
            if (gate.type === 'LOG_OUTPUT') {
                return 'LOG';
            }
            
            const displayMap = {
                'INPUT': () => `IN=${gate.userValue || 0}`,
                'OUTPUT': () => `OUT=${gate.value || 0}`,
                'PUSH_BUTTON': () => gate.isPushed ? 'PUSH=1' : 'PUSH=0',
                'TOGGLE_BUTTON': () => `TOG=${gate.userValue || 0}`,
                'DC': () => `DC=${gate.userValue || 0}`,
                'BUFFER': () => 'BUF', 'NOT': () => 'NOT', 'AND': () => 'AND', 'OR': () => 'OR',
                'NAND': () => 'NAND', 'NOR': () => 'NOR', 'XOR': () => 'XOR', 'XNOR': () => 'XNOR',
                'HALF_ADDER': () => 'HA', 'FULL_ADDER': () => 'FA', 'BIT4_ADDER': () => '4ADD',
                'COMPLEMENT': () => 'COMP', 'SEG7': () => '7SEG', 'BIT4_7SEG': () => '4→7SEG',
                'D_FF': () => 'D-FF', 'T_FF': () => 'T-FF', 'JK_FF': () => 'JK-FF', 'RS_FF': () => 'RS-FF',
                'BIT_MEMORY': () => 'MEM', 'DELAY': () => 'DEL', 'BUFFER8': () => '8BUF',
                'ALU_181': () => '74HC181', 'DIVIDER4': () => 'DIV4', 'MULTIPLIER4': () => 'MUL4',
                'MEMORY4': () => 'MEM4', 'MEMORY8': () => 'MEM8', 'LED': () => 'LED', 'DIODE': () => 'DIODE',
                'COUNTER': () => 'CNT', 'REGISTER': () => 'REG', 'SHIFTREG': () => 'SHIFT',
                'LATCH_SR': () => 'SR', 'LATCH_D': () => 'D-L', 'LATCH_T': () => 'T-L', 'LATCH_JK': () => 'JK-L',
                'COMPARATOR': () => 'CMP', 'ANALOG_SWITCH': () => 'ASW', 'ANALOG_MUX': () => 'AMUX',
                'OSCILLATOR': () => 'OSC', 'PLL': () => 'PLL', 'TRANSISTOR': () => 'TR'
            };
            
            // 多入力ゲート
            if (gate.type.match(/^(AND|OR|NAND|NOR|XOR|XNOR)\d+$/)) {
                return gate.type;
            }
            
            // カスタムゲート
            if (gate.type.startsWith('CUSTOM_')) {
                return customGates[gate.type]?.name || gate.type;
            }
            
            return displayMap[gate.type] ? displayMap[gate.type]() : gate.type;
        }
        
        // ゲートイベント設定
        function setupGateEvents(gate, gateEl) {
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };
            
            // クリックイベント
            gateEl.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (currentMode === 'SELECT') {
                    if (gate.selected) {
                        // 既に選択されている場合は設定を開く
                        if (isPro8Gate(gate.type)) {
                            showConfigDialog(gate);
                        }
                    } else {
                        // 選択していない場合は選択する
                        clearSelection();
                        selectGate(gate);
                    }
                }
            });
            
            // マウスダウン
            gateEl.addEventListener('mousedown', function(e) {
                if (e.target.classList.contains('pin')) return;
                
                isDragging = true;
                dragOffset.x = e.offsetX;
                dragOffset.y = e.offsetY;
                
                if (currentMode !== 'SELECT') {
                    selectGate(gate);
                }
                e.preventDefault();
            });
            
            // ダブルクリック
            gateEl.addEventListener('dblclick', function(e) {
                // Pro10: 設定可能ゲートの設定ダイアログを開く
                if (isPro10ConfigurableGate(gate.type)) {
                    showConfigDialog(gate);
                    return;
                }
                
                // 従来の入力ゲート値変更
                if (gate.type === 'INPUT' || gate.type === 'PUSH_BUTTON' || gate.type === 'TOGGLE_BUTTON' || gate.type === 'DC') {
                    gate.userValue = gate.userValue ? 0 : 1;
                    gate.value = gate.userValue;
                    updateGateDisplay(gate);
                    status.textContent = `${gate.type} (ID:${gate.id}) の値を ${gate.value} に変更`;
                }
            });
            
            // マウスムーブ（ドラッグ）
            document.addEventListener('mousemove', function(e) {
                if (isDragging && selectedGate === gate) {
                    const rect = canvas.getBoundingClientRect();
                    gate.x = e.clientX - rect.left - dragOffset.x;
                    gate.y = e.clientY - rect.top - dragOffset.y;
                    
                    gateEl.style.left = gate.x + 'px';
                    gateEl.style.top = gate.y + 'px';
                    
                    updateConnectedWires(gate);
                }
            });
            
            // マウスアップ
            document.addEventListener('mouseup', function() {
                isDragging = false;
            });
            
            // TOGGLE_BUTTON専用イベント
            if (gate.type === 'TOGGLE_BUTTON') {
                gateEl.addEventListener('click', function(e) {
                    if (currentMode !== 'SELECT') {
                        gate.userValue = gate.userValue === 0 ? 1 : 0;
                        gate.value = gate.userValue;
                        updateGateDisplay(gate);
                        e.stopPropagation();
                    }
                });
            }
            
            // PUSH_BUTTON専用イベント
            if (gate.type === 'PUSH_BUTTON') {
                gateEl.addEventListener('mousedown', function(e) {
                    if (e.target.classList.contains('pin')) return;
                    if (currentMode !== 'SELECT') {
                        gate.isPushed = true;
                        gate.value = 1;
                        updateGateDisplay(gate);
                        e.stopPropagation();
                    }
                });
                
                gateEl.addEventListener('mouseup', function() {
                    if (gate.type === 'PUSH_BUTTON') {
                        gate.isPushed = false;
                        gate.value = 0;
                        updateGateDisplay(gate);
                    }
                });
                
                gateEl.addEventListener('mouseleave', function() {
                    if (gate.type === 'PUSH_BUTTON') {
                        gate.isPushed = false;
                        gate.value = 0;
                        updateGateDisplay(gate);
                    }
                });
            }
        }
        
        // ゲート選択
        function selectGate(gate) {
            if (selectedGate) {
                selectedGate.element.classList.remove('selected');
            }
            selectedGate = gate;
            gate.element.classList.add('selected');
        }
        
        // ゲート表示更新
        function updateGateDisplay(gate) {
            if (gate.type === 'LED' && gate.ledElement) {
                gate.ledElement.style.background = gate.inputs[0] ? '#ff0000' : '#333';
            }
            
            if (gate.type === 'SEG7' && gate.displayElement) {
                updateSegmentDisplay(gate);
            }
            
            if (gate.type === 'BIT4_7SEG' && gate.displayElement) {
                updateBit4SegmentDisplay(gate);
            }
            
            // ゲートのアクティブ状態更新
            const isActive = gate.outputs.some(output => output === 1);
            if (isActive) {
                gate.element.classList.add('active');
            } else {
                gate.element.classList.remove('active');
            }
        }
        
        // 7セグメント表示更新
        function updateSegmentDisplay(gate) {
            const segmentPatterns = {
                0: [1,1,1,1,1,1,0], 1: [0,1,1,0,0,0,0], 2: [1,1,0,1,1,0,1],
                3: [1,1,1,1,0,0,1], 4: [0,1,1,0,0,1,1], 5: [1,0,1,1,0,1,1],
                6: [1,0,1,1,1,1,1], 7: [1,1,1,0,0,0,0], 8: [1,1,1,1,1,1,1],
                9: [1,1,1,1,0,1,1], A: [1,1,1,0,1,1,1], b: [0,0,1,1,1,1,1],
                C: [1,0,0,1,1,1,0], d: [0,1,1,1,1,0,1], E: [1,0,0,1,1,1,1],
                F: [1,0,0,0,1,1,1]
            };
            
            let value = 0;
            for (let i = 0; i < 7; i++) {
                if (gate.inputs[i]) value |= (1 << i);
            }
            
            const pattern = segmentPatterns[value] || [0,0,0,0,0,0,0];
            gate.displayElement.textContent = value.toString(16).toUpperCase();
        }
        
        function updateBit4SegmentDisplay(gate) {
            let value = 0;
            for (let i = 0; i < 4; i++) {
                if (gate.inputs[i]) value |= (1 << i);
            }
            gate.displayElement.textContent = value.toString(16).toUpperCase();
        }
        
        // 選択モードでのクリック処理
    // ゲート選択クリック処理
    function handleSelectClick(e) {
            const clickedGate = findGateAt(e.offsetX, e.offsetY);
            
            if (clickedGate) {
                // ゲートがクリックされた場合
                if (clickedGate.selected) {
                    // 既に選択されている場合は設定を開く
                    if (isPro8Gate(clickedGate.type)) {
                        showConfigDialog(clickedGate);
                    }
                } else {
                    // 選択していない場合は選択する
                    clearSelection();
                    selectGate(clickedGate);
                }
            } else {
                // 空の場所がクリックされた場合は選択解除
                clearSelection();
            }
        }
        
        // ゲートを座標で検索
        function findGateAt(x, y) {
            for (let gate of gates) {
                if (x >= gate.x && x <= gate.x + gate.width && 
                    y >= gate.y && y <= gate.y + gate.height) {
                    return gate;
                }
            }
            return null;
        }
        
        // ゲート選択
        function selectGate(gate) {
            gate.selected = true;
            gate.element.style.border = '3px solid #007bff';
            gate.element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)';
        }
        
        // 選択解除
        function clearSelection() {
            gates.forEach(gate => {
                if (gate.selected) {
                    gate.selected = false;
                    gate.element.style.border = '1px solid #000';
                    gate.element.style.boxShadow = 'none';
                }
            });
        }
        
        function handlePinClick(gate, pin, e) {
            const pinType = pin.dataset.pinType;
            const pinIndex = parseInt(pin.dataset.pinIndex);
            
            document.querySelectorAll('.pin').forEach(p => p.classList.remove('highlight'));
            pin.classList.add('highlight');
            
            if (pinType === 'output') {
                if (wireStart?.element) wireStart.element.style.border = '';
                wireStart = { gate: gate, pin: pinIndex, element: pin };
                pin.style.border = '2px solid #ff0';
                status.textContent = `配線開始: ${gate.type}${gate.id} の出力${pinIndex} → 入力ピン（赤）をクリックしてください`;
            } else if (pinType === 'input') {
                if (wireStart) {
                    createWire(wireStart.gate, wireStart.pin, gate, pinIndex);
                    if (wireStart.element) wireStart.element.style.border = '';
                    document.querySelectorAll('.pin').forEach(p => { p.classList.remove('highlight'); p.style.border = ''; });
                    wireStart = null;
                    status.textContent = `配線完了: ${gate.type}${gate.id} の入力${pinIndex} に接続されました`;
                } else {
                    status.textContent = '最初に出力ピン（青）をクリックして配線を開始してください';
                }
            }
        }

        function clearPinHighlights() {
            document.querySelectorAll('.pin').forEach(p => { p.classList.remove('highlight'); p.style.border = ''; });
            if (wireStart?.element) wireStart.element.style.border = '';
            wireStart = null;
        }
        
        function createWire(outputGate, outputPin, inputGate, inputPin) {
            if (inputGate.inputConnections[inputPin]) {
                status.textContent = 'この入力ピンは既に接続されています';
                return;
            }
            
            const wire = {
                id: wireId++,
                outputGate: outputGate.id,
                outputPin: outputPin,
                inputGate: inputGate.id,
                inputPin: inputPin,
                value: 0,
                element: createWireElement(outputGate, outputPin, inputGate, inputPin)
            };
            
            inputGate.inputConnections[inputPin] = wire;
            wire.element.addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm('この配線を削除しますか？')) {
                    canvas.removeChild(wire.element);
                    wires.splice(wires.findIndex(w => w.id === wire.id), 1);
                    inputGate.inputConnections[inputPin] = null;
                    status.textContent = '配線を削除しました';
                }
            });
            
            wires.push(wire);
            canvas.appendChild(wire.element);
            status.textContent = `配線が作成されました: ${outputGate.type}${outputGate.id} → ${inputGate.type}${inputGate.id}`;
        }
        
        // 配線要素作成
        function createWireElement(outputGate, outputPin, inputGate, inputPin) {
            const wireEl = document.createElement('div');
            wireEl.className = 'wire';
            
            updateWirePosition(wireEl, outputGate, outputPin, inputGate, inputPin);
            
            return wireEl;
        }
        
        // 配線位置更新
        function updateWirePosition(wireEl, outputGate, outputPin, inputGate, inputPin) {
            const outputSpec = GATE_SPECS[outputGate.type];
            const inputSpec = GATE_SPECS[inputGate.type];
            
            const outputSpacing = Math.max(12, Math.min(15, (outputSpec.height - 20) / outputSpec.outputs));
            const inputSpacing = Math.max(12, Math.min(15, (inputSpec.height - 20) / inputSpec.inputs));
            
            const outputStartY = (outputSpec.height - (outputSpec.outputs - 1) * outputSpacing) / 2;
            const inputStartY = (inputSpec.height - (inputSpec.inputs - 1) * inputSpacing) / 2;
            
            const x1 = outputGate.x + outputSpec.width;
            const y1 = outputGate.y + outputStartY + outputPin * outputSpacing;
            const x2 = inputGate.x;
            const y2 = inputGate.y + inputStartY + inputPin * inputSpacing;
            
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            wireEl.style.left = x1 + 'px';
            wireEl.style.top = (y1 - 1) + 'px';
            wireEl.style.width = length + 'px';
            wireEl.style.transform = `rotate(${angle}deg)`;
        }
        
        // 接続された配線更新
        function updateConnectedWires(gate) {
            wires.forEach(wire => {
                const outputGate = gates.find(g => g.id === wire.outputGate);
                const inputGate = gates.find(g => g.id === wire.inputGate);
                
                if (outputGate === gate || inputGate === gate) {
                    updateWirePosition(wire.element, outputGate, wire.outputPin, inputGate, wire.inputPin);
                }
            });
        }
        
        // 配線関連の処理
    // 配線クリック処理
    function handleWireClick(e) {
            const pin = e.target;
            if (!pin.classList.contains('pin')) {
                wireStart = null;
                status.textContent = 'ピンをクリックしてください';
                return;
            }
            
            const gateId = parseInt(pin.dataset.gateId);
            const pinType = pin.dataset.pinType;
            const pinIndex = parseInt(pin.dataset.pinIndex);
            
            if (!wireStart) {
                if (pinType === 'output') {
                    wireStart = {gateId, pinIndex, pin};
                    status.textContent = '入力ピンをクリックして接続を完了してください';
                } else {
                    status.textContent = '最初に出力ピンをクリックしてください';
                }
            } else {
                if (pinType === 'input') {
                    if (wireStart.gateId === gateId) {
                        status.textContent = '同じゲート内での接続はできません';
                        wireStart = null;
                        return;
                    }
                    createWire(wireStart.gateId, wireStart.pinIndex, gateId, pinIndex);
                    wireStart = null;
                    status.textContent = '配線が完了しました';
                } else {
                    status.textContent = '入力ピンをクリックしてください';
                }
            }
        }
        
        // ゲート評価（Pro6+Pro7+Pro8統合）
        function evaluateGate(gate) {
            switch (gate.type) {
                // Pro8新機能ゲート
                case 'KEY_INPUT':
                    const isKeyPressed = keyStates[gate.config.key] || false;
                    gate.outputs[0] = isKeyPressed ? 1 : 0;
                    break;
                    
                case 'TIMER_PULSE':
                    // タイマーパルス生成（activeTimers連携）
                    if (!gate.config) {
                        gate.config = { interval: 1000, enabled: false };
                        gate.outputs[0] = 0;
                    }
                    // 実際のタイマー制御はstartTimer/activeTimersで管理
                    // ここでは現在の値を維持
                    if (!gate.outputs[0]) gate.outputs[0] = 0;
                    break;
                    
                case 'TOGGLE_INPUT':
                    gate.outputs[0] = gate.config.state ? 1 : 0;
                    break;
                    
                case 'COUNTER_GATE':
                    // 4bit出力
                    for (let i = 0; i < 4; i++) {
                        gate.outputs[i] = (gate.config.count >> i) & 1;
                    }
                    break;
                    
                case 'LOG_OUTPUT':
                    // ログ出力ゲート：入力値をログとして記録
                    if (!gate.config) gate.config = { logs: [], maxLines: 100 };
                    const logInputValue = gate.inputs[0] || 0;
                    if (gate.lastInputValue !== logInputValue) {
                        const timestamp = new Date().toLocaleTimeString();
                        const logEntry = `[${timestamp}] Input: ${logInputValue}`;
                        gate.config.logs.push(logEntry);
                        
                        // 最大行数制限
                        if (gate.config.logs.length > gate.config.maxLines) {
                            gate.config.logs.shift();
                        }
                        
                        gate.lastInputValue = logInputValue;
                        
                        // 状態表示領域にログを表示
                        const statusArea = document.getElementById('status');
                        if (statusArea && gate.config.logs.length > 0) {
                            statusArea.innerHTML = `Log ${gate.id}: ${gate.config.logs.slice(-5).join('<br>')}`;
                        }
                    }
                    gate.outputs[0] = logInputValue; // パススルー
                    break;
                
                case 'INPUT':
                case 'PUSH_BUTTON':
                case 'TOGGLE_BUTTON':
                case 'DC':
                    gate.outputs[0] = gate.userValue || 0;
                    gate.value = gate.outputs[0];
                    break;
                    
                case 'BUFFER':
                    gate.outputs[0] = gate.inputs[0] || 0;
                    break;
                    
                case 'NOT':
                    gate.outputs[0] = gate.inputs[0] ? 0 : 1;
                    break;
                    
                case 'AND':
                    gate.outputs[0] = (gate.inputs[0] && gate.inputs[1]) ? 1 : 0;
                    break;
                    
                case 'OR':
                    gate.outputs[0] = (gate.inputs[0] || gate.inputs[1]) ? 1 : 0;
                    break;
                    
                case 'NAND':
                    gate.outputs[0] = (gate.inputs[0] && gate.inputs[1]) ? 0 : 1;
                    break;
                    
                case 'NOR':
                    gate.outputs[0] = (gate.inputs[0] || gate.inputs[1]) ? 0 : 1;
                    break;
                    
                case 'XOR':
                    gate.outputs[0] = (gate.inputs[0] !== gate.inputs[1]) ? 1 : 0;
                    break;
                    
                case 'XNOR':
                    gate.outputs[0] = (gate.inputs[0] === gate.inputs[1]) ? 1 : 0;
                    break;
                    
                // 算術回路
                case 'HALF_ADDER':
                    const halfSum = (gate.inputs[0] || 0) + (gate.inputs[1] || 0);
                    gate.outputs[0] = halfSum % 2; // Sum
                    gate.outputs[1] = Math.floor(halfSum / 2); // Carry
                    break;
                    
                case 'FULL_ADDER':
                    const fullSum = (gate.inputs[0] || 0) + (gate.inputs[1] || 0) + (gate.inputs[2] || 0);
                    gate.outputs[0] = fullSum % 2; // Sum
                    gate.outputs[1] = Math.floor(fullSum / 2); // Carry
                    break;
                    
                // Pro7：ALU、除算器、乗算器等
                case 'ALU_181':
                    evaluateALU181(gate);
                    break;
                    
                case 'DIVIDER4':
                    evaluateDivider4(gate);
                    break;
                    
                case 'MULTIPLIER4':
                    evaluateMultiplier4(gate);
                    break;
                    
                case 'MEMORY4':
                    evaluateMemory4(gate);
                    break;
                    
                case 'MEMORY8':
                    evaluateMemory8(gate);
                    break;
                    
                case 'COUNTER':
                    evaluateCounter(gate);
                    break;
                    
                case 'COMPARATOR':
                    evaluateComparator(gate);
                    break;
                    
                case 'OSCILLATOR':
                    gate.oscillatorState = !gate.oscillatorState;
                    gate.outputs[0] = gate.oscillatorState ? 1 : 0;
                    break;
                    
                // Pro6フリップフロップ
                case 'D_FF':
                    if (gate.state === undefined) gate.state = 0;
                    if (gate.lastClk === undefined) gate.lastClk = 0;
                    
                    const clk_d = gate.inputs[1] || 0;
                    const d = gate.inputs[0] || 0;
                    if (clk_d && !gate.lastClk) {
                        gate.state = d;
                    }
                    gate.lastClk = clk_d;
                    gate.outputs[0] = gate.state || 0;
                    gate.outputs[1] = gate.state ? 0 : 1; // Q̄
                    break;
                    
                case 'T_FF':
                    if (gate.state === undefined) gate.state = 0;
                    if (gate.lastClk === undefined) gate.lastClk = 0;
                    
                    const clk_t = gate.inputs[1] || 0;
                    const t = gate.inputs[0] || 0;
                    if (clk_t && !gate.lastClk && t) {
                        gate.state = gate.state ? 0 : 1;
                    }
                    gate.lastClk = clk_t;
                    gate.outputs[0] = gate.state || 0;
                    gate.outputs[1] = gate.state ? 0 : 1; // Q̄
                    break;
                    
                case 'JK_FF':
                    if (gate.state === undefined) gate.state = 0;
                    if (gate.lastClk === undefined) gate.lastClk = 0;
                    
                    const clk_jk = gate.inputs[2] || 0;
                    const j = gate.inputs[0] || 0;
                    const k = gate.inputs[1] || 0;
                    if (clk_jk && !gate.lastClk) {
                        if (j && k) {
                            gate.state = gate.state ? 0 : 1; // Toggle
                        } else if (j) {
                            gate.state = 1; // Set
                        } else if (k) {
                            gate.state = 0; // Reset
                        }
                    }
                    gate.lastClk = clk_jk;
                    gate.outputs[0] = gate.state || 0;
                    gate.outputs[1] = gate.state ? 0 : 1; // Q̄
                    break;
                    
                case 'RS_FF':
                    if (gate.state === undefined) gate.state = 0;
                    
                    const r = gate.inputs[0] || 0;
                    const s = gate.inputs[1] || 0;
                    if (s && !r) {
                        gate.state = 1;
                    } else if (r && !s) {
                        gate.state = 0;
                    }
                    gate.outputs[0] = gate.state || 0;
                    gate.outputs[1] = gate.state ? 0 : 1; // Q̄
                    break;
                    
                // Pro6メモリ・バッファ
                case 'BIT_MEMORY':
                    const write = gate.inputs[1] || 0;
                    const data = gate.inputs[0] || 0;
                    if (write) {
                        gate.storedValue = data;
                    }
                    gate.outputs[0] = gate.storedValue || 0;
                    break;
                    
                case 'DELAY':
                    if (!gate.delayBuffer) gate.delayBuffer = [];
                    gate.delayBuffer.push(gate.inputs[0] || 0);
                    if (gate.delayBuffer.length > 2) {
                        gate.outputs[0] = gate.delayBuffer.shift();
                    } else {
                        gate.outputs[0] = 0;
                    }
                    break;
                    
                case 'BUFFER8':
                    for (let i = 0; i < 8; i++) {
                        gate.outputs[i] = gate.inputs[i] || 0;
                    }
                    break;
                    
                case 'BIT4_ADDER':
                    let carry = gate.inputs[8] || 0; // Cin
                    for (let i = 0; i < 4; i++) {
                        const a = gate.inputs[i] || 0;
                        const b = gate.inputs[i + 4] || 0;
                        const sum = a + b + carry;
                        gate.outputs[i] = sum % 2;
                        carry = Math.floor(sum / 2);
                    }
                    gate.outputs[4] = carry; // Cout
                    break;
                    
                case 'COMPLEMENT':
                    for (let i = 0; i < 4; i++) {
                        gate.outputs[i] = (gate.inputs[i] || 0) ? 0 : 1;
                    }
                    break;
                    
                // Pro6複合ゲート
                case 'MUX':
                    const sel = gate.inputs[2] || 0;
                    gate.outputs[0] = sel ? (gate.inputs[1] || 0) : (gate.inputs[0] || 0);
                    break;
                    
                case 'DEMUX':
                    const input = gate.inputs[0] || 0;
                    const select = gate.inputs[1] || 0;
                    gate.outputs[0] = select === 0 ? input : 0;
                    gate.outputs[1] = select === 1 ? input : 0;
                    gate.outputs[2] = select === 2 ? input : 0;
                    gate.outputs[3] = select === 3 ? input : 0;
                    break;
                    
                case 'ENCODER':
                    let encoderOutput = 0;
                    for (let i = 3; i >= 0; i--) {
                        if (gate.inputs[i]) {
                            encoderOutput = i;
                            break;
                        }
                    }
                    gate.outputs[0] = encoderOutput & 1;
                    gate.outputs[1] = (encoderOutput >> 1) & 1;
                    break;
                    
                case 'DECODER':
                    const decoderInput = ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
                    for (let i = 0; i < 4; i++) {
                        gate.outputs[i] = (i === decoderInput) ? 1 : 0;
                    }
                    break;
                    
                case 'MAJORITY':
                    const count = (gate.inputs[0] || 0) + (gate.inputs[1] || 0) + (gate.inputs[2] || 0);
                    gate.outputs[0] = count >= 2 ? 1 : 0;
                    break;
                    
                case 'PARITY':
                    gate.outputs[0] = ((gate.inputs[0] || 0) + (gate.inputs[1] || 0)) % 2;
                    break;
                    
                // Pro7ラッチ
                case 'LATCH_SR':
                    const s_latch = gate.inputs[1] || 0;
                    const r_latch = gate.inputs[0] || 0;
                    if (s_latch && !r_latch) {
                        gate.latchState = 1;
                    } else if (r_latch && !s_latch) {
                        gate.latchState = 0;
                    }
                    gate.outputs[0] = gate.latchState || 0;
                    gate.outputs[1] = gate.latchState ? 0 : 1;
                    break;
                    
                case 'LATCH_D':
                    const en_d = gate.inputs[1] || 0;
                    const d_latch = gate.inputs[0] || 0;
                    if (en_d) {
                        gate.latchState = d_latch;
                    }
                    gate.outputs[0] = gate.latchState || 0;
                    gate.outputs[1] = gate.latchState ? 0 : 1;
                    break;
                    
                case 'LATCH_T':
                    const en_t = gate.inputs[1] || 0;
                    const t_latch = gate.inputs[0] || 0;
                    if (en_t && t_latch) {
                        gate.latchState = gate.latchState ? 0 : 1;
                    }
                    gate.outputs[0] = gate.latchState || 0;
                    gate.outputs[1] = gate.latchState ? 0 : 1;
                    break;
                    
                case 'LATCH_JK':
                    const en_jk = gate.inputs[2] || 0;
                    const j_latch = gate.inputs[0] || 0;
                    const k_latch = gate.inputs[1] || 0;
                    if (en_jk) {
                        if (j_latch && k_latch) {
                            gate.latchState = gate.latchState ? 0 : 1;
                        } else if (j_latch) {
                            gate.latchState = 1;
                        } else if (k_latch) {
                            gate.latchState = 0;
                        }
                    }
                    gate.outputs[0] = gate.latchState || 0;
                    gate.outputs[1] = gate.latchState ? 0 : 1;
                    break;
                    
                // Pro7レジスタ・シフトレジスタ
                case 'REGISTER':
                    const clk_reg = gate.inputs[8] || 0;
                    if (clk_reg && !gate.lastClk) {
                        for (let i = 0; i < 8; i++) {
                            gate.registerData[i] = gate.inputs[i] || 0;
                        }
                    }
                    gate.lastClk = clk_reg;
                    for (let i = 0; i < 8; i++) {
                        gate.outputs[i] = gate.registerData[i] || 0;
                    }
                    break;
                    
                case 'SHIFTREG':
                    const clk_shift = gate.inputs[8] || 0;
                    const shift_in = gate.inputs[0] || 0;
                    if (clk_shift && !gate.lastClk) {
                        if (!gate.shiftData) gate.shiftData = [0,0,0,0,0,0,0,0];
                        gate.shiftData.unshift(shift_in);
                        gate.shiftData.pop();
                    }
                    gate.lastClk = clk_shift;
                    for (let i = 0; i < 8; i++) {
                        gate.outputs[i] = gate.shiftData[i] || 0;
                    }
                    break;
                    
                // Pro7アナログ
                case 'ANALOG_SWITCH':
                    const control = gate.inputs[1] || 0;
                    gate.outputs[0] = control ? (gate.inputs[0] || 0) : 0;
                    break;
                    
                case 'ANALOG_MUX':
                    // SEL信号は最後の入力（index 8）
                    const sel_analog = gate.inputs[8] || 0;
                    // 3ビットセレクト信号で8つの入力から選択
                    const selectIndex = Math.min(sel_analog, 7);
                    gate.outputs[0] = gate.inputs[selectIndex] || 0;
                    break;
                    
                case 'PLL':
                    // Phase-Locked Loop - 位相同期回路
                    const refClock = gate.inputs[0] || 0;
                    const feedbackClock = gate.inputs[1] || 0;
                    const controlVoltage = gate.inputs[2] || 0;
                    
                    if (!gate.pllState) {
                        gate.pllState = {
                            vcoFreq: gate.config?.vcoFreq || 1000, // Hz
                            phase: 0,
                            integrator: 0,
                            lastRefTime: Date.now(),
                            lastFeedbackTime: Date.now(),
                            locked: false
                        };
                    }
                    
                    const pllCurrentTime = Date.now();
                    
                    // 位相比較器
                    const refEdge = refClock && !gate.pllState.lastRefValue;
                    const fbEdge = feedbackClock && !gate.pllState.lastFeedbackValue;
                    
                    if (refEdge) gate.pllState.lastRefTime = pllCurrentTime;
                    if (fbEdge) gate.pllState.lastFeedbackTime = pllCurrentTime;
                    
                    // 位相差計算
                    const phaseDiff = gate.pllState.lastRefTime - gate.pllState.lastFeedbackTime;
                    
                    // ループフィルタ（積分器）
                    const kp = gate.config?.kp || 0.1; // 比例ゲイン
                    const ki = gate.config?.ki || 0.01; // 積分ゲイン
                    gate.pllState.integrator += phaseDiff * ki;
                    
                    // VCO制御電圧
                    const vcoPcontrol = phaseDiff * kp + gate.pllState.integrator + controlVoltage;
                    
                    // VCO周波数制御
                    const baseFreq = gate.pllState.vcoFreq;
                    const freqDeviation = vcoPcontrol * (gate.config?.sensitivity || 100);
                    const actualFreq = Math.max(0, baseFreq + freqDeviation);
                    
                    // VCO出力生成
                    const pllPeriod = actualFreq > 0 ? 1000 / actualFreq : 1000;
                    gate.pllState.phase += (pllCurrentTime - (gate.pllState.lastUpdateTime || pllCurrentTime)) / pllPeriod * 2 * Math.PI;
                    gate.pllState.lastUpdateTime = pllCurrentTime;
                    
                    // ロック検出
                    gate.pllState.locked = Math.abs(phaseDiff) < (gate.config?.lockThreshold || 5);
                    
                    // 出力
                    gate.outputs[0] = Math.sin(gate.pllState.phase) > 0 ? 1 : 0; // VCO出力
                    gate.outputs[1] = gate.pllState.locked ? 1 : 0; // ロック検出信号
                    
                    gate.pllState.lastRefValue = refClock;
                    gate.pllState.lastFeedbackValue = feedbackClock;
                    break;
                    
                case 'TRANSISTOR':
                    const base = gate.inputs[0] || 0;
                    const emitter = gate.inputs[1] || 0;
                    gate.outputs[0] = base && emitter ? 1 : 0;
                    break;
                    
                case 'LED':
                    // LED：入力に応じて表示（出力なし）
                    gate.value = gate.inputs[0] || 0;
                    break;
                    
                case 'DIODE':
                    // ダイオード：順方向のみ通す
                    const diodeInput = gate.inputs[0] || 0;
                    const vf = gate.config?.vf || 0; // 順方向電圧降下
                    gate.outputs[0] = (diodeInput > vf) ? (diodeInput - vf) : 0;
                    break;
                    
                case 'RESISTOR':
                    // 抵抗：詳細なオームの法則とキルヒホッフの法則による解析
                    const resistorInput = gate.inputs[0] || 0;
                    const resistance = gate.config?.resistance || 1000; // Ω
                    const supplyVoltage = gate.config?.supplyVoltage || 5.0; // V
                    const groundConnection = gate.inputs[1] || 0; // グラウンド接続
                    
                    // 入力電圧をアナログ値として処理
                    const inputVoltage = resistorInput * supplyVoltage;
                    
                    // 電流計算 I = V / R
                    const current = resistance > 0 ? inputVoltage / resistance : 0;
                    
                    // 電力計算 P = I²R
                    const power = current * current * resistance;
                    
                    // 電圧降下計算
                    const voltageDrop = current * resistance;
                    const resistorOutputVoltage = Math.max(0, inputVoltage - voltageDrop);
                    
                    // 熱雑音計算（ジョンソン・ナイキスト雑音）
                    const ambientTemp = gate.config?.temperature || 300; // K (室温27℃)
                    const boltzmann = 1.38e-23; // J/K
                    const bandwidth = gate.config?.bandwidth || 1e6; // Hz
                    const thermalNoise = Math.sqrt(4 * boltzmann * ambientTemp * resistance * bandwidth);
                    
                    // デジタル閾値変換（2.5V基準）
                    const resistorDigitalThreshold = 2.5;
                    gate.outputs[0] = resistorOutputVoltage > resistorDigitalThreshold ? 1 : 0;
                    
                    // アナログ情報も保存
                    gate.analogState = {
                        voltage: resistorOutputVoltage,
                        current: current,
                        power: power,
                        resistance: resistance,
                        thermalNoise: thermalNoise,
                        temperature: ambientTemp
                    };
                    break;
                    
                case 'DC':
                    // DC電源：設定電圧を出力
                    const voltage = gate.config?.voltage || 5.0;
                    gate.outputs[0] = voltage > 2.5 ? 1 : 0; // デジタル閾値変換
                    gate.value = gate.outputs[0];
                    break;
                    
                case 'OSCILLATOR':
                    // 高精度発振器：実際の水晶発振器をモデル化
                    if (!gate.oscillatorState) {
                        gate.oscillatorState = {
                            phase: 0,
                            lastTime: performance.now(),
                            state: 0,
                            frequency: gate.config?.frequency || 1000,
                            startupTime: gate.config?.startupTime || 1, // ms
                            isStarted: false,
                            temperatureDrift: 0,
                            agingDrift: 0,
                            phaseDrift: 0
                        };
                    }
                    
                    const nominalFreq = gate.config?.frequency || 1000; // Hz
                    const oscCurrentTime = performance.now();
                    const deltaTime = oscCurrentTime - gate.oscillatorState.lastTime;
                    
                    // 温度ドリフト計算
                    const tempCoeff = gate.config?.tempCoeff || 20e-6; // ppm/℃
                    const oscTemperature = gate.config?.temperature || 25; // ℃
                    const tempDrift = (oscTemperature - 25) * tempCoeff * nominalFreq;
                    
                    // エージングドリフト
                    const agingRate = gate.config?.agingRate || 1e-6; // ppm/年
                    const runningTime = oscCurrentTime / (1000 * 60 * 60 * 24 * 365); // 年
                    const agingDrift = runningTime * agingRate * nominalFreq;
                    
                    // 位相雑音
                    const phaseNoise = gate.config?.phaseNoise || 1e-9; // rad²/Hz
                    const randomPhase = (Math.random() - 0.5) * Math.sqrt(phaseNoise);
                    
                    // 実効周波数
                    const effectiveFreq = nominalFreq + tempDrift + agingDrift;
                    
                    // スタートアップ処理
                    if (!gate.oscillatorState.isStarted) {
                        if (oscCurrentTime >= gate.oscillatorState.startupTime) {
                            gate.oscillatorState.isStarted = true;
                        } else {
                            gate.outputs[0] = 0;
                            break;
                        }
                    }
                    
                    // 位相計算
                    gate.oscillatorState.phase += 2 * Math.PI * effectiveFreq * deltaTime / 1000;
                    gate.oscillatorState.phase += randomPhase;
                    
                    // 位相を0-2πに正規化
                    gate.oscillatorState.phase = gate.oscillatorState.phase % (2 * Math.PI);
                    
                    // 波形生成
                    const waveform = gate.config?.waveform || 'square';
                    let output = 0;
                    
                    switch (waveform) {
                        case 'sine':
                            output = (Math.sin(gate.oscillatorState.phase) + 1) / 2;
                            break;
                        case 'triangle':
                            const trianglePhase = gate.oscillatorState.phase / (2 * Math.PI);
                            output = trianglePhase < 0.5 ? trianglePhase * 2 : 2 - trianglePhase * 2;
                            break;
                        case 'sawtooth':
                            output = gate.oscillatorState.phase / (2 * Math.PI);
                            break;
                        case 'square':
                        default:
                            output = gate.oscillatorState.phase < Math.PI ? 1 : 0;
                            break;
                    }
                    
                    // デューティサイクル調整
                    const dutyCycle = gate.config?.dutyCycle || 0.5;
                    if (waveform === 'square') {
                        output = gate.oscillatorState.phase < (2 * Math.PI * dutyCycle) ? 1 : 0;
                    }
                    
                    gate.outputs[0] = output;
                    gate.oscillatorState.lastTime = oscCurrentTime;
                    
                    // パフォーマンス情報
                    gate.oscillatorState.analytics = {
                        effectiveFrequency: effectiveFreq,
                        temperatureDrift: tempDrift,
                        agingDrift: agingDrift,
                        phaseNoise: randomPhase,
                        dutyCycle: dutyCycle
                    };
                    break;
                    
                case 'DELAY':
                    // 高精度遅延素子：実際の伝播遅延をナノ秒単位で処理
                    if (!gate.delayBuffer) {
                        gate.delayBuffer = [];
                        gate.delayState = {
                            lastInputValue: 0,
                            transitionCount: 0,
                            accumulatedJitter: 0
                        };
                    }
                    
                    const inputValue = gate.inputs[0] || 0;
                    const delayTimeNs = gate.config?.delayTime || 100; // ナノ秒
                    const jitter = gate.config?.jitter || 0; // ジッタ（ns）
                    const temperatureCoeff = gate.config?.tempCoeff || 0.001; // 温度係数 per ℃
                    const voltageCoeff = gate.config?.voltageCoeff || 0.01; // 電圧係数 per V
                    const delayTemperature = gate.config?.temperature || 25; // ℃
                    const supplyVolt = gate.config?.supplyVoltage || 5.0; // V
                    
                    // 温度・電圧による遅延変動
                    const tempVariation = (delayTemperature - 25) * temperatureCoeff;
                    const voltageVariation = (supplyVolt - 5.0) * voltageCoeff;
                    
                    // ランダムジッタ
                    const randomJitter = jitter > 0 ? (Math.random() - 0.5) * 2 * jitter : 0;
                    gate.delayState.accumulatedJitter += randomJitter * 0.1; // 累積ジッタ
                    
                    // 実効遅延時間
                    const effectiveDelay = delayTimeNs * (1 + tempVariation + voltageVariation) + 
                                         randomJitter + gate.delayState.accumulatedJitter;
                    
                    // 高精度タイムスタンプ（マイクロ秒精度）
                    const currentTimeMicros = performance.now() * 1000; // マイクロ秒
                    const delayMicros = Math.max(0, effectiveDelay / 1000); // ns → μs
                    
                    // 遷移検出
                    if (inputValue !== gate.delayState.lastInputValue) {
                        gate.delayState.transitionCount++;
                        gate.delayBuffer.push({
                            value: inputValue,
                            timestamp: currentTimeMicros,
                            delayTime: delayMicros,
                            transitionId: gate.delayState.transitionCount
                        });
                    }
                    
                    // 出力値決定
                    let outputValue = gate.delayState.lastInputValue;
                    
                    // 遅延バッファから出力すべき値を検索
                    for (let i = gate.delayBuffer.length - 1; i >= 0; i--) {
                        const item = gate.delayBuffer[i];
                        if (currentTimeMicros - item.timestamp >= item.delayTime) {
                            outputValue = item.value;
                            // 処理済みのアイテムを削除
                            gate.delayBuffer.splice(0, i + 1);
                            break;
                        }
                    }
                    
                    // 古いデータのクリーンアップ（1ms以上古い）
                    gate.delayBuffer = gate.delayBuffer.filter(item => 
                        currentTimeMicros - item.timestamp < 1000
                    );
                    
                    gate.outputs[0] = outputValue;
                    gate.delayState.lastInputValue = inputValue;
                    
                    // パフォーマンス情報
                    gate.delayAnalytics = {
                        effectiveDelay: effectiveDelay,
                        jitterAccumulated: gate.delayState.accumulatedJitter,
                        transitionCount: gate.delayState.transitionCount,
                        bufferSize: gate.delayBuffer.length
                    };
                    break;
                    
                case 'TRANSISTOR':
                    // 高精度トランジスタモデル：Ebers-Mollモデルベース
                    const baseVoltage = (gate.inputs[0] || 0) * (gate.config?.supplyVoltage || 5.0); // V
                    const collectorVoltage = (gate.inputs[1] || 0) * (gate.config?.supplyVoltage || 5.0); // V
                    const emitterVoltage = (gate.inputs[2] || 0) * (gate.config?.supplyVoltage || 5.0); // V
                    
                    // トランジスタパラメータ
                    const vbe_on = gate.config?.vbe_on || 0.7; // ベース-エミッタ順方向電圧
                    const vce_sat = gate.config?.vce_sat || 0.2; // コレクタ-エミッタ飽和電圧
                    const beta_f = gate.config?.beta_f || 100; // 順方向電流増幅率
                    const beta_r = gate.config?.beta_r || 1; // 逆方向電流増幅率
                    const is_npn = gate.config?.is_npn !== false; // NPNトランジスタ（デフォルト）
                    const thermalVoltage = 0.026; // 室温での熱電圧 (kT/q)
                    const saturationCurrent = gate.config?.is || 1e-12; // 飽和電流
                    
                    // 接合電圧計算
                    const vbe = is_npn ? (baseVoltage - emitterVoltage) : (emitterVoltage - baseVoltage);
                    const vbc = is_npn ? (baseVoltage - collectorVoltage) : (collectorVoltage - baseVoltage);
                    const vce = is_npn ? (collectorVoltage - emitterVoltage) : (emitterVoltage - collectorVoltage);
                    
                    let ic = 0, ib = 0, ie = 0; // コレクタ、ベース、エミッタ電流
                    let operatingRegion = 'cutoff';
                    
                    // 動作領域判定とモデル計算
                    if (vbe < vbe_on && vbc < vbe_on) {
                        // カットオフ領域
                        operatingRegion = 'cutoff';
                        ic = ib = ie = 0;
                    } else if (vbe >= vbe_on && vbc < vbe_on) {
                        // 順方向アクティブ領域
                        operatingRegion = 'forward_active';
                        
                        // Ebers-Mollモデル
                        const icc = saturationCurrent * (Math.exp(vbe / thermalVoltage) - 1);
                        const ibc = saturationCurrent * (Math.exp(vbc / thermalVoltage) - 1);
                        
                        ic = (icc - ibc) / (1 + 1/beta_f);
                        ib = ic / beta_f + ibc;
                        ie = ic + ib;
                        
                        // 温度依存性
                        const tempCoeff = gate.config?.tempCoeff || 0.002; // per ℃
                        const temp = gate.config?.temperature || 25; // ℃
                        const tempFactor = 1 + (temp - 25) * tempCoeff;
                        ic *= tempFactor;
                        
                    } else if (vbe >= vbe_on && vbc >= vbe_on) {
                        // 飽和領域
                        operatingRegion = 'saturation';
                        
                        // 飽和時の電流制限
                        const ic_sat = (collectorVoltage - vce_sat) / (gate.config?.loadResistance || 1000);
                        ic = Math.max(0, ic_sat);
                        ib = ic / beta_f + saturationCurrent * (Math.exp(vbc / thermalVoltage) - 1);
                        ie = ic + ib;
                        
                    } else if (vbe < vbe_on && vbc >= vbe_on) {
                        // 逆方向アクティブ領域
                        operatingRegion = 'reverse_active';
                        
                        const icc = saturationCurrent * (Math.exp(vbe / thermalVoltage) - 1);
                        const ibc = saturationCurrent * (Math.exp(vbc / thermalVoltage) - 1);
                        
                        ic = -(ibc - icc) / (1 + 1/beta_r);
                        ib = -ic / beta_r + icc;
                        ie = ic + ib;
                    }
                    
                    // 出力電圧計算
                    const transistorOutputVoltage = collectorVoltage - ic * (gate.config?.loadResistance || 1000) / 1000;
                    
                    // デジタル出力変換
                    const transistorDigitalThreshold = (gate.config?.supplyVoltage || 5.0) / 2;
                    gate.outputs[0] = transistorOutputVoltage > transistorDigitalThreshold ? 1 : 0;
                    
                    // 詳細状態情報
                    gate.transistorState = {
                        vbe: vbe,
                        vbc: vbc,
                        vce: vce,
                        ic: ic,
                        ib: ib,
                        ie: ie,
                        operatingRegion: operatingRegion,
                        outputVoltage: transistorOutputVoltage,
                        powerDissipation: Math.abs(vce * ic + vbe * ib),
                        gain: ic !== 0 ? ic / ib : 0
                    };
                    break;
                    
                case 'OUTPUT':
                    gate.value = gate.inputs[0] || 0;
                    gate.state = gate.value; // 状態も更新
                    gate.outputs[0] = gate.value; // 出力も設定
                    break;
                    
                case 'SEG7':
                case 'BIT4_7SEG':
                    // 表示専用
                    break;
                    
                default:
                    // デフォルト：最初の入力をそのまま出力
                    gate.outputs[0] = gate.inputs[0] || 0;
            }
        }
        
        // ALU 74HC181評価
        function evaluateALU181(gate) {
            const A = ((gate.inputs[3] || 0) << 3) | ((gate.inputs[2] || 0) << 2) | ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
            const B = ((gate.inputs[7] || 0) << 3) | ((gate.inputs[6] || 0) << 2) | ((gate.inputs[5] || 0) << 1) | (gate.inputs[4] || 0);
            const S = ((gate.inputs[11] || 0) << 3) | ((gate.inputs[10] || 0) << 2) | ((gate.inputs[9] || 0) << 1) | (gate.inputs[8] || 0);
            const Cin = gate.inputs[12] || 0;
            const M = gate.inputs[13] || 0;
            
            let result = 0;
            if (M === 0) { // 算術演算
                switch (S) {
                    case 0: result = A; break;
                    case 1: result = A | B; break;
                    case 2: result = A | (~B & 0xF); break;
                    case 3: result = -1; break;
                    case 4: result = A | (A & (~B & 0xF)); break;
                    case 5: result = (A | B) | (A & (~B & 0xF)); break;
                    case 6: result = A - B - 1 + Cin; break;
                    case 7: result = (A & (~B & 0xF)) - 1 + Cin; break;
                    case 8: result = A | (A & B); break;
                    case 9: result = A + B + Cin; break;
                    case 10: result = (A | (~B & 0xF)) + (A & B) + Cin; break;
                    case 11: result = (A & B) - 1 + Cin; break;
                    case 12: result = A + A + Cin; break;
                    case 13: result = (A | B) + A + Cin; break;
                    case 14: result = (A | (~B & 0xF)) + A + Cin; break;
                    case 15: result = A - 1 + Cin; break;
                }
            } else { // 論理演算
                switch (S) {
                    case 0: result = ~A & 0xF; break;
                    case 1: result = ~(A | B) & 0xF; break;
                    case 2: result = (~A & 0xF) & B; break;
                    case 3: result = 0; break;
                    case 4: result = ~(A & B) & 0xF; break;
                    case 5: result = ~B & 0xF; break;
                    case 6: result = A ^ B; break;
                    case 7: result = A & (~B & 0xF); break;
                    case 8: result = (~A & 0xF) | B; break;
                    case 9: result = ~(A ^ B) & 0xF; break;
                    case 10: result = B; break;
                    case 11: result = A & B; break;
                    case 12: result = 1; break;
                    case 13: result = A | (~B & 0xF); break;
                    case 14: result = A | B; break;
                    case 15: result = A; break;
                }
            }
            
            result = result & 0xF;
            gate.outputs[0] = result & 1;
            gate.outputs[1] = (result >> 1) & 1;
            gate.outputs[2] = (result >> 2) & 1;
            gate.outputs[3] = (result >> 3) & 1;
            gate.outputs[4] = (A === B) ? 1 : 0; // A=B
            gate.outputs[5] = (result > 15) ? 1 : 0; // Carry out
            gate.outputs[6] = 1; // P (Propagate)
            gate.outputs[7] = 0; // G (Generate)
        }
        
        // 4bit除算器評価
        function evaluateDivider4(gate) {
            const A = ((gate.inputs[3] || 0) << 3) | ((gate.inputs[2] || 0) << 2) | ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
            const B = ((gate.inputs[7] || 0) << 3) | ((gate.inputs[6] || 0) << 2) | ((gate.inputs[5] || 0) << 1) | (gate.inputs[4] || 0);
            
            if (B === 0) {
                // 0除算エラー
                for (let i = 0; i < 8; i++) gate.outputs[i] = 1;
            } else {
                const quotient = Math.floor(A / B);
                const remainder = A % B;
                
                // 商の出力 (4bit)
                gate.outputs[0] = quotient & 1;
                gate.outputs[1] = (quotient >> 1) & 1;
                gate.outputs[2] = (quotient >> 2) & 1;
                gate.outputs[3] = (quotient >> 3) & 1;
                
                // 余りの出力 (4bit)
                gate.outputs[4] = remainder & 1;
                gate.outputs[5] = (remainder >> 1) & 1;
                gate.outputs[6] = (remainder >> 2) & 1;
                gate.outputs[7] = (remainder >> 3) & 1;
            }
        }
        
        // 4bit乗算器評価
        function evaluateMultiplier4(gate) {
            const A = ((gate.inputs[3] || 0) << 3) | ((gate.inputs[2] || 0) << 2) | ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
            const B = ((gate.inputs[7] || 0) << 3) | ((gate.inputs[6] || 0) << 2) | ((gate.inputs[5] || 0) << 1) | (gate.inputs[4] || 0);
            
            const product = A * B;
            
            for (let i = 0; i < 8; i++) {
                gate.outputs[i] = (product >> i) & 1;
            }
        }
        
        // 4bitメモリ評価
        function evaluateMemory4(gate) {
            if (!gate.memoryData) gate.memoryData = new Array(2).fill(0); // 2bit address = 4 locations
            
            const address = gate.inputs[4] || 0;
            const writeEnable = gate.inputs[5] || 0;
            
            if (writeEnable) {
                // 書き込み
                const data = ((gate.inputs[3] || 0) << 3) | ((gate.inputs[2] || 0) << 2) | ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
                gate.memoryData[address] = data;
            }
            
            // 読み出し
            const readData = gate.memoryData[address] || 0;
            gate.outputs[0] = readData & 1;
            gate.outputs[1] = (readData >> 1) & 1;
            gate.outputs[2] = (readData >> 2) & 1;
            gate.outputs[3] = (readData >> 3) & 1;
        }
        
        // 8bitメモリ評価
        function evaluateMemory8(gate) {
            if (!gate.memoryData) gate.memoryData = new Array(2).fill(0); // 1bit address = 2 locations for 8bit data
            
            const address = gate.inputs[8] || 0;
            const writeEnable = gate.inputs[9] || 0;
            
            if (writeEnable) {
                let data = 0;
                for (let i = 0; i < 8; i++) {
                    data |= ((gate.inputs[i] || 0) << i);
                }
                gate.memoryData[address] = data;
            }
            
            const readData = gate.memoryData[address] || 0;
            for (let i = 0; i < 8; i++) {
                gate.outputs[i] = (readData >> i) & 1;
            }
        }
        
        // カウンタ評価
        function evaluateCounter(gate) {
            if (gate.counterValue === undefined) gate.counterValue = 0;
            if (gate.lastClk === undefined) gate.lastClk = 0;
            
            const clk = gate.inputs[0] || 0;
            const reset = gate.inputs[1] || 0;
            const enable = gate.inputs[2] || 0;
            
            if (reset) {
                gate.counterValue = 0;
            } else if (enable && clk && !gate.lastClk) {
                gate.counterValue = (gate.counterValue + 1) % 16;
            }
            
            gate.lastClk = clk;
            
            gate.outputs[0] = gate.counterValue & 1;
            gate.outputs[1] = (gate.counterValue >> 1) & 1;
            gate.outputs[2] = (gate.counterValue >> 2) & 1;
            gate.outputs[3] = (gate.counterValue >> 3) & 1;
        }
        
        // コンパレータ評価
        function evaluateComparator(gate) {
            const A = ((gate.inputs[3] || 0) << 3) | ((gate.inputs[2] || 0) << 2) | ((gate.inputs[1] || 0) << 1) | (gate.inputs[0] || 0);
            const B = ((gate.inputs[7] || 0) << 3) | ((gate.inputs[6] || 0) << 2) | ((gate.inputs[5] || 0) << 1) | (gate.inputs[4] || 0);
            
            gate.outputs[0] = (A > B) ? 1 : 0; // A>B
            gate.outputs[1] = (A === B) ? 1 : 0; // A=B
            gate.outputs[2] = (A < B) ? 1 : 0; // A<B
        }
        
        // シミュレーション実行
        // シミュレーション実行：全ゲート・配線の状態を複数回評価し、依存関係を解決
        function simulate() {
            for (let iteration = 0; iteration < 5; iteration++) {
                gates.forEach(gate => {
                    evaluateGate(gate);
                    updateGateDisplay(gate);
                });
                // 配線値を伝播
                wires.forEach(wire => {
                    const outputGate = gates.find(g => g.id === wire.outputGate);
                    const inputGate = gates.find(g => g.id === wire.inputGate);
                    if (outputGate && inputGate) {
                        wire.value = outputGate.outputs[wire.outputPin] || 0;
                        inputGate.inputs[wire.inputPin] = wire.value;
                        // 配線の表示更新
                        if (wire.value) {
                            wire.element.classList.add('active');
                        } else {
                            wire.element.classList.remove('active');
                        }
                    }
                });
            }
            status.textContent = 'シミュレーション実行完了';
        }
        
        // その他の関数群（UI操作等）
        function stepSimulate() {
            // ステップシミュレーション：1サイクルずつゲートを評価
            const allGates = gates.filter(g => g.type !== 'INPUT' && g.type !== 'PUSH_BUTTON' && g.type !== 'TOGGLE_BUTTON' && g.type !== 'DC');
            if (stepIndex === 0) {
                const inputGates = gates.filter(g => g.type === 'INPUT' || g.type === 'PUSH_BUTTON' || g.type === 'TOGGLE_BUTTON' || g.type === 'DC');
                inputGates.forEach(gate => {
                    evaluateGate(gate);
                    updateGateDisplay(gate);
                });
                status.textContent = 'ステップ1: 入力ゲートを評価';
                stepIndex++;
            } else if (stepIndex <= allGates.length) {
                const gate = allGates[stepIndex - 1];
                evaluateGate(gate);
                updateGateDisplay(gate);
                wires.forEach(wire => {
                    const fromGate = gates.find(g => g.id === wire.outputGate);
                    wire.value = fromGate ? fromGate.outputs[wire.outputPin] : 0;
                });
                updateWires();
                status.textContent = `ステップ${stepIndex + 1}: ${gate.type}${gate.id}を評価`;
                stepIndex++;
            } else {
                stepIndex = 0;
                status.textContent = 'ステップシミュレーション完了';
            }
        }
        function resetSimulation() {
            // シミュレーションリセット：ゲート・配線・表示を初期化
            gates.forEach(gate => {
                if (gate.type !== 'INPUT' && gate.type !== 'PUSH_BUTTON' && gate.type !== 'TOGGLE_BUTTON' && gate.type !== 'DC') {
                    gate.outputs.fill(0);
                    gate.value = 0;
                }
                updateGateDisplay(gate);
            });
            wires.forEach(wire => {
                wire.value = 0;
            });
            updateWires();
            stepIndex = 0;
            status.textContent = 'シミュレーションをリセットしました';
        }
        
    // 選択中ゲート削除
    function deleteSelected() {
            if (selectedGate) {
                canvas.removeChild(selectedGate.element);
                gates = gates.filter(g => g.id !== selectedGate.id);
                wires = wires.filter(w => w.inputGate !== selectedGate.id && w.outputGate !== selectedGate.id);
                selectedGate = null;
                status.textContent = '選択されたゲートを削除しました';
            }
        }
        
        // ゲート選択
    // ゲート選択
    function selectGate(gate) {
            if (selectedGate) {
                selectedGate.element.classList.remove('selected');
            }
            selectedGate = gate;
            gate.element.classList.add('selected');
            status.textContent = `選択: ${gate.type}${gate.id}`;
        }
        
        // 配線更新
    // 配線表示更新
    function updateWires() {
            wires.forEach(wire => {
                const fromGate = gates.find(g => g.id === wire.outputGate);
                const toGate = gates.find(g => g.id === wire.inputGate);
                
                if (fromGate && toGate) {
                    const fromSpec = GATE_SPECS[fromGate.type];
                    const toSpec = GATE_SPECS[toGate.type];
                    
                    const outputSpacing = Math.max(12, Math.min(15, (fromSpec.height - 20) / fromSpec.outputs));
                    const outputStartY = (fromSpec.height - (fromSpec.outputs - 1) * outputSpacing) / 2;
                    
                    const inputSpacing = Math.max(12, Math.min(15, (toSpec.height - 20) / toSpec.inputs));
                    const inputStartY = (toSpec.height - (toSpec.inputs - 1) * inputSpacing) / 2;
                    
                    const fromX = fromGate.x + fromGate.width;
                    const fromY = fromGate.y + outputStartY + wire.outputPin * outputSpacing;
                    const toX = toGate.x;
                    const toY = toGate.y + inputStartY + wire.inputPin * inputSpacing;
                    
                    const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
                    const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
                    
                    wire.element.style.left = fromX + 'px';
                    wire.element.style.top = fromY + 'px';
                    wire.element.style.width = distance + 'px';
                    wire.element.style.transform = `rotate(${angle}deg)`;
                    
                    if (wire.value === 1) {
                        wire.element.classList.add('active');
                    } else {
                        wire.element.classList.remove('active');
                    }
                }
            });
        }
        
    // ゲート表示更新
        function updateGateDisplay(gate) {
            let textSpan = gate.element.querySelector('.gate-text');
            if (!textSpan) {
                textSpan = document.createElement('span');
                textSpan.className = 'gate-text';
                Object.assign(textSpan.style, {
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)', pointerEvents: 'none',
                    fontSize: '10px', fontWeight: 'bold'
                });
                gate.element.appendChild(textSpan);
            }
            textSpan.textContent = getGateDisplayText(gate);
            
            // アクティブ状態の更新
            gate.element.classList.toggle('active', gate.value === 1);
            
            // 表示デバイスの更新
            if (['SEG7', 'BIT4_7SEG'].includes(gate.type)) updateSegmentDisplay(gate);
            if (gate.type === 'LED' && gate.ledElement) {
                gate.ledElement.style.background = gate.inputs[0] ? '#ff0000' : '#333';
            }
        }
        
        // 7セグメント表示更新
        function updateSegmentDisplay(gate) {
            if (!gate.displayElement) return;
            
            if (gate.type === 'SEG7') {
                const segments = gate.inputs.map((_, i) => {
                    const conn = gate.inputConnections[i];
                    return conn ? (gates.find(g => g.id === conn.fromGateId)?.outputs[conn.fromPinIndex] || 0) : 0;
                });
                gate.displayElement.textContent = segments.join('');
            } else if (gate.type === 'BIT4_7SEG') {
                const bits = gate.inputs.slice(0, 4).map((_, i) => {
                    const conn = gate.inputConnections[i];
                    return conn ? (gates.find(g => g.id === conn.fromGateId)?.outputs[conn.fromPinIndex] || 0) : 0;
                });
                const value = bits[0] + bits[1] * 2 + bits[2] * 4 + bits[3] * 8;
                gate.displayElement.textContent = value.toString(16).toUpperCase();
            }
        }
        

        
        function saveGateConfig(gateId) {
            const gate = gates.find(g => g.id === gateId);
            if (!gate) return;

            switch (gate.type) {
                case 'KEY_INPUT':
                    const key = document.getElementById('keySelect').value;
                    const desc = document.getElementById('keyDescription').value;
                    gate.config.key = key;
                    gate.config.description = desc || key;
                    break;
                case 'TIMER_PULSE':
                    gate.config.interval = parseInt(document.getElementById('timerInterval').value);
                    const wasEnabled = gate.config.enabled;
                    gate.config.enabled = document.getElementById('timerEnabled').checked;
                    if (gate.config.enabled && !wasEnabled) startTimer(gate);
                    else if (!gate.config.enabled && wasEnabled && activeTimers.has(gate.id)) {
                        clearInterval(activeTimers.get(gate.id));
                        activeTimers.delete(gate.id);
                    }
                    break;
                case 'COUNTER_GATE':
                    gate.config.max = parseInt(document.getElementById('counterMax').value);
                    gate.config.count = parseInt(document.getElementById('counterValue').value);
                    break;
                case 'LOG_OUTPUT':
                    gate.config.maxLines = parseInt(document.getElementById('logMaxLines').value);
                    break;
                    
                // Pro10: 基本論理ゲートの設定
                case 'AND': case 'OR': case 'NAND': case 'NOR': case 'XOR': case 'XNOR':
                    gate.config.inputPins = parseInt(document.getElementById('inputPins').value);
                    gate.config.delay = parseInt(document.getElementById('propagationDelay').value);
                    // ピン数変更時にゲートを再構築
                    rebuildGateWithNewPins(gate);
                    break;
                    
                case 'BUFFER':
                    gate.config.delay = parseInt(document.getElementById('propagationDelay').value);
                    gate.config.driveStrength = document.getElementById('driveStrength').value;
                    break;
                    
                case 'LED':
                    gate.config.color = document.getElementById('ledColor').value;
                    gate.config.brightness = parseInt(document.getElementById('ledBrightness').value);
                    updateLEDAppearance(gate);
                    break;
                    
                case 'DC':
                    gate.config.voltage = parseFloat(document.getElementById('dcVoltage').value);
                    gate.config.currentLimit = parseInt(document.getElementById('currentLimit').value);
                    // より現実的な閾値判定: 電圧・電流両方を考慮
                    // 例: 2.0V未満→0, 2.0V以上3.3V未満→1, 3.3V以上→過電圧エラー
                    if (gate.config.voltage < 2.0) {
                        gate.userValue = 0;
                    } else if (gate.config.voltage < 3.3) {
                        // 電流制限も考慮（例: 0.5A未満なら正常、0.5A以上なら警告）
                        if (gate.config.currentLimit < 0.5) {
                            gate.userValue = 1;
                        } else {
                            gate.userValue = 1;
                            alert('警告: 電流制限値が高すぎます（0.5A以上）');
                        }
                    } else {
                        gate.userValue = 0;
                        alert('エラー: DC電圧が高すぎます（3.3V以上）');
                    }
                    break;
                    
                case 'OSCILLATOR':
                    gate.config.frequency = parseInt(document.getElementById('frequency').value);
                    gate.config.waveform = document.getElementById('waveform').value;
                    gate.config.amplitude = parseFloat(document.getElementById('amplitude').value);
                    break;
                    
                case 'DELAY':
                    gate.config.delayTime = parseInt(document.getElementById('delayTime').value);
                    gate.config.delayUnit = document.getElementById('delayUnit').value;
                    break;
                    
                case 'MEMORY4': case 'MEMORY8':
                    gate.config.memorySize = parseInt(document.getElementById('memorySize').value);
                    gate.config.dataWidth = parseInt(document.getElementById('dataWidth').value);
                    gate.config.accessTime = parseInt(document.getElementById('accessTime').value);
                    // メモリサイズ変更時にメモリを再初期化
                    gate.memoryData = {};
                    break;
                    
                case 'BIT4_ADDER':
                    gate.config.bits = parseInt(document.getElementById('adderBits').value);
                    gate.config.computeTime = parseInt(document.getElementById('computeTime').value);
                    rebuildAdderWithNewBits(gate);
                    break;
                    
                case 'DECODER': case 'ENCODER':
                    gate.config.inputBits = parseInt(document.getElementById('inputBits').value);
                    gate.config.delay = parseInt(document.getElementById('propagationDelay').value);
                    rebuildCoderWithNewBits(gate);
                    break;
                    
                case 'RESISTOR':
                    gate.config.resistance = parseFloat(document.getElementById('resistanceValue').value);
                    gate.config.tolerance = parseFloat(document.getElementById('tolerance').value);
                    gate.config.powerRating = parseFloat(document.getElementById('powerRating').value);
                    break;
                    
                case 'DC':
                    gate.config.voltage = parseFloat(document.getElementById('dcVoltage').value);
                    gate.config.currentLimit = parseInt(document.getElementById('currentLimit').value);
                    gate.config.resistance = parseFloat(document.getElementById('internalResistance').value);
                    gate.userValue = gate.config.voltage > 2.5 ? 1 : 0; // デジタル閾値変換
                    break;
                    
                case 'OSCILLATOR':
                    gate.config.frequency = parseInt(document.getElementById('frequency').value);
                    gate.config.waveform = document.getElementById('waveform').value;
                    gate.config.amplitude = parseFloat(document.getElementById('amplitude').value);
                    break;
                    
                case 'DELAY':
                    gate.config.delayTime = parseInt(document.getElementById('delayTime').value);
                    gate.config.delayUnit = document.getElementById('delayUnit').value;
                    break;
                    
                case 'TRANSISTOR':
                    gate.config.type = document.getElementById('transistorType').value;
                    gate.config.beta = parseInt(document.getElementById('gainBeta').value);
                    gate.config.vth = parseFloat(document.getElementById('thresholdVoltage').value);
                    break;
                    
                case 'DIODE':
                    gate.config.vf = parseFloat(document.getElementById('forwardVoltage').value);
                    gate.config.maxCurrent = parseInt(document.getElementById('maxCurrent').value);
                    gate.config.type = document.getElementById('diodeType').value;
                    break;
            }
            
            updateGateDisplay(gate);
            closeConfigDialog();
            status.textContent = `${gate.type} の設定を保存しました`;
        }

        // Pro10: ゲート再構築ヘルパー関数
        function rebuildGateWithNewPins(gate) {
            const newPinCount = gate.config.inputPins;
            const oldInputCount = gate.inputs.length;
            
            // 入力配列のサイズを調整
            if (newPinCount > oldInputCount) {
                for (let i = oldInputCount; i < newPinCount; i++) {
                    gate.inputs.push(0);
                    gate.inputConnections.push(null);
                }
            } else if (newPinCount < oldInputCount) {
                // 削除される接続を切断
                for (let i = newPinCount; i < oldInputCount; i++) {
                    if (gate.inputConnections[i]) {
                        removeWire(gate.inputConnections[i]);
                    }
                }
                gate.inputs.splice(newPinCount);
                gate.inputConnections.splice(newPinCount);
            }
            
            // GATE_SPECSを動的に更新
            if (GATE_SPECS[gate.type]) {
                GATE_SPECS[gate.type].inputs = newPinCount;
            }
            
            // UI要素を再構築
            recreateGatePins(gate);
        }
        
        function rebuildAdderWithNewBits(gate) {
            const bits = gate.config.bits;
            const inputCount = bits * 2 + 1; // A inputs + B inputs + carry in
            const outputCount = bits + 1; // sum outputs + carry out
            
            gate.inputs = new Array(inputCount).fill(0);
            gate.outputs = new Array(outputCount).fill(0);
            gate.inputConnections = new Array(inputCount).fill(null);
            
            recreateGatePins(gate);
        }
        
        function rebuildCoderWithNewBits(gate) {
            const inputBits = gate.config.inputBits;
            if (gate.type === 'DECODER') {
                gate.inputs = new Array(inputBits + 1).fill(0); // data + enable
                gate.outputs = new Array(1 << inputBits).fill(0); // 2^n outputs
                gate.inputConnections = new Array(inputBits + 1).fill(null);
            } else { // ENCODER
                gate.inputs = new Array(1 << inputBits).fill(0); // 2^n inputs
                gate.outputs = new Array(inputBits + 1).fill(0); // data + valid
                gate.inputConnections = new Array(1 << inputBits).fill(null);
            }
            
            recreateGatePins(gate);
        }
        
        function recreateGatePins(gate) {
            // 既存のピンを削除
            const pins = gate.element.querySelectorAll('.pin');
            pins.forEach(pin => pin.remove());
            
            // 既存のピンラベルも削除
            const pinLabels = gate.element.querySelectorAll('.pin-label');
            pinLabels.forEach(label => label.remove());
            
            // GATE_SPECSから仕様を取得
            const spec = GATE_SPECS[gate.type];
            if (spec) {
                // 新しいピンを作成
                addPins(gate, gate.element, spec);
            }
            
            updateConnectedWires(gate);
        }
        
        function updateLEDAppearance(gate) {
            if (gate.ledElement) {
                const colorMap = {
                    'red': '#ff0000', 'green': '#00ff00', 'blue': '#0000ff',
                    'yellow': '#ffff00', 'orange': '#ff8000', 'purple': '#8000ff',
                    'white': '#ffffff'
                };
                const baseColor = colorMap[gate.config.color] || '#ff0000';
                const brightness = gate.config.brightness / 100;
                
                if (gate.inputs[0]) {
                    gate.ledElement.style.background = baseColor;
                    gate.ledElement.style.opacity = brightness;
                    gate.ledElement.style.boxShadow = `0 0 10px ${baseColor}`;
                } else {
                    gate.ledElement.style.background = '#333';
                    gate.ledElement.style.opacity = '0.3';
                    gate.ledElement.style.boxShadow = 'none';
                }
            }
        }

        function clearLog(gateId) {
            logHistory.delete(gateId);
            const gate = gates.find(g => g.id === gateId);
            if (gate && gate.logElement) gate.logElement.innerHTML = '';
        }

        // 配線削除関数
        function removeWire(wire) {
            if (!wire) return;
            
            // 配線要素をDOMから削除
            if (wire.element && wire.element.parentNode) {
                wire.element.parentNode.removeChild(wire.element);
            }
            
            // 入力ゲートの接続をクリア
            const inputGate = gates.find(g => g.id === wire.inputGate);
            if (inputGate) {
                inputGate.inputs[wire.inputPin] = 0;
                inputGate.inputConnections[wire.inputPin] = null;
            }
            
            // wiresリストから削除
            const wireIndex = wires.findIndex(w => w === wire);
            if (wireIndex !== -1) {
                wires.splice(wireIndex, 1);
            }
        }
        
        // 段階実行
        let stepIndex = 0;
        function stepSimulate() {
            const allGates = gates.filter(g => g.type !== 'INPUT' && g.type !== 'PUSH_BUTTON' && g.type !== 'TOGGLE_BUTTON' && g.type !== 'DC');
            
            if (stepIndex === 0) {
                const inputGates = gates.filter(g => g.type === 'INPUT' || g.type === 'PUSH_BUTTON' || g.type === 'TOGGLE_BUTTON' || g.type === 'DC');
                inputGates.forEach(gate => {
                    evaluateGate(gate);
                    updateGateDisplay(gate);
                });
                status.textContent = 'ステップ1: 入力ゲートを評価';
                stepIndex++;
            } else if (stepIndex <= allGates.length) {
                const gate = allGates[stepIndex - 1];
                evaluateGate(gate);
                updateGateDisplay(gate);
                
                wires.forEach(wire => {
                    const fromGate = gates.find(g => g.id === wire.outputGate);
                    wire.value = fromGate ? fromGate.outputs[wire.outputPin] : 0;
                });
                updateWires();
                
                status.textContent = `ステップ${stepIndex + 1}: ${gate.type}${gate.id}を評価`;
                stepIndex++;
            } else {
                status.textContent = '段階実行完了！';
                stepIndex = 0;
            }
        }
        
        // リセット
        function resetSimulation() {
            gates.forEach(gate => {
                if (gate.type !== 'INPUT' && gate.type !== 'PUSH_BUTTON' && gate.type !== 'TOGGLE_BUTTON' && gate.type !== 'DC') {
                    gate.outputs.fill(0);
                    gate.value = 0;
                }
                updateGateDisplay(gate);
            });
            
            wires.forEach(wire => {
                wire.value = 0;
            });
            
            updateWires();
            stepIndex = 0;
            status.textContent = 'シミュレーションをリセットしました';
        }
        
        // 自動配置
        function autoLayout() {
            const inputGates = gates.filter(g => g.type === 'INPUT' || g.type === 'PUSH_BUTTON' || g.type === 'TOGGLE_BUTTON' || g.type === 'DC');
            const outputGates = gates.filter(g => g.type === 'OUTPUT');
            const otherGates = gates.filter(g => g.type !== 'INPUT' && g.type !== 'OUTPUT' && g.type !== 'PUSH_BUTTON' && g.type !== 'TOGGLE_BUTTON' && g.type !== 'DC');
            
            // 入力を左側に配置
            inputGates.forEach((gate, i) => {
                gate.x = 50;
                gate.y = 50 + i * 80;
                gate.element.style.left = gate.x + 'px';
                gate.element.style.top = gate.y + 'px';
            });
            
            // 出力を右側に配置
            outputGates.forEach((gate, i) => {
                gate.x = canvas.clientWidth - gate.width - 50;
                gate.y = 50 + i * 80;
                gate.element.style.left = gate.x + 'px';
                gate.element.style.top = gate.y + 'px';
            });
            
            // その他のゲートを中央に配置
            otherGates.forEach((gate, i) => {
                gate.x = 300 + (i % 3) * 150;
                gate.y = 50 + Math.floor(i / 3) * 100;
                gate.element.style.left = gate.x + 'px';
                gate.element.style.top = gate.y + 'px';
            });
            
            updateWires();
            status.textContent = 'レイアウトを自動調整しました';
        }
        
        // 選択削除
        function deleteSelected() {
            if (!selectedGate) {
                alert('削除するゲートを選択してください');
                return;
            }
            
            if (confirm(`選択したゲートを削除しますか？`)) {
                deleteGate(selectedGate.id);
            }
        }
        
        // ゲート削除
        function deleteGate(gateId) {
            const gateIndex = gates.findIndex(g => g.id === gateId);
            if (gateIndex === -1) return;
            
            const gate = gates[gateIndex];
            
            // 関連する配線を削除
            const wiresToDelete = wires.filter(w => w.outputGate === gateId || w.inputGate === gateId);
            wiresToDelete.forEach(wire => {
                wire.element.remove();
                const wireIndex = wires.findIndex(w => w.id === wire.id);
                if (wireIndex !== -1) {
                    wires.splice(wireIndex, 1);
                }
                
                // 接続情報をクリア
                const toGate = gates.find(g => g.id === wire.inputGate);
                if (toGate) {
                    toGate.inputConnections[wire.inputPin] = null;
                }
            });
            
            // ゲート削除
            gate.element.remove();
            gates.splice(gateIndex, 1);
            
            if (selectedGate === gate) {
                selectedGate = null;
            }
            
            status.textContent = `ゲートを削除しました`;
        }
        
        function clearAll() {
            if (confirm('全ての回路を削除しますか？')) {
                canvas.innerHTML = '';
                gates = [];
                wires = [];
                gateId = 0;
                wireId = 0;
                wireStart = null;
                selectedGate = null;
                currentMode = null;
                status.textContent = 'クリアしました';
                
                document.querySelectorAll('.gate-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                document.querySelectorAll('.toolbar button').forEach(btn => {
                    btn.style.background = '';
                    btn.style.color = '';
                });
            }
        }
        
        // 保存機能
        function saveCircuit() {
            const circuitData = {
                gates: gates.map(gate => ({
                    id: gate.id,
                    type: gate.type,
                    x: gate.x,
                    y: gate.y,
                    userValue: gate.userValue,
                    memoryData: gate.memoryData,
                    counterValue: gate.counterValue
                })),
                wires: wires.map(wire => ({
                    id: wire.id,
                    outputGate: wire.outputGate,
                    outputPin: wire.outputPin,
                    inputGate: wire.inputGate,
                    inputPin: wire.inputPin
                }))
            };
            
            const dataStr = JSON.stringify(circuitData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            const timestamp = new Date().toISOString().slice(0,19).replace(/[-T:]/g,'');
            link.download = `circuit_pro13_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            status.textContent = '回路を保存しました';
        }
        
        // 読み込み機能
        function loadCircuit() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const data = JSON.parse(e.target.result);
                            clearAll();
                            data.gates.forEach(gData => {
                                const spec = GATE_SPECS[gData.type];
                                addGate(gData.type, gData.x + spec.width/2, gData.y + spec.height/2);
                                const gate = gates[gates.length - 1];
                                Object.assign(gate, {id: gData.id, userValue: gData.userValue, 
                                    memoryData: gData.memoryData, counterValue: gData.counterValue});
                                if (gate.userValue !== null) gate.value = gate.userValue;
                                updateGateDisplay(gate);
                            });
                            data.wires.forEach(wData => createWire(
                                gates.find(g => g.id === wData.outputGate), wData.outputPin,
                                gates.find(g => g.id === wData.inputGate), wData.inputPin
                            ));
                            status.textContent = '回路を読み込みました';
                        } catch (error) {
                            alert('ファイルの読み込みに失敗しました');
                            status.textContent = 'ファイルの読み込みに失敗しました';
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }
        
        // 画像保存機能
        function exportImage() {
            const svg = `<svg width="${canvas.offsetWidth}" height="${canvas.offsetHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="white"/>
                ${gates.map(gate => `<rect x="${gate.x}" y="${gate.y}" width="${gate.width}" height="${gate.height}" fill="lightblue" stroke="black"/>
                <text x="${gate.x + gate.width/2}" y="${gate.y + gate.height/2}" text-anchor="middle" font-size="10">${gate.type}</text>`).join('')}
                ${wires.map(wire => {
                    const fromGate = gates.find(g => g.id === wire.outputGate);
                    const toGate = gates.find(g => g.id === wire.inputGate);
                    if (fromGate && toGate) {
                        const fromX = fromGate.x + fromGate.width;
                        const fromY = fromGate.y + 25 + wire.outputPin * 15;
                        const toX = toGate.x;
                        const toY = toGate.y + 25 + wire.inputPin * 15;
                        return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="black" stroke-width="2"/>`;
                    }
                    return '';
                }).join('')}
            </svg>`;
            
            const blob = new Blob([svg], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `circuit_${ver.Pro}.svg`;
            link.click();
            
            status.textContent = '画像を保存しました';
        }

        // Pro14 HDL出力機能
        function exportVerilogHDL() {
            const verilogCode = generateVerilogCode();
            downloadTextFile(verilogCode, `circuit_${ver.Pro}.v`, 'text/verilog');
            status.textContent = 'Verilog HDLを出力しました';
        }

        function exportVHDLHDL() {
            const vhdlCode = generateVHDLCode();
            downloadTextFile(vhdlCode, `circuit_${ver.Pro}.vhd`, 'text/vhdl');
            status.textContent = 'VHDL HDLを出力しました';
        }

        function generateVerilogCode() {
            const moduleName = hdlOutput.moduleName || `circuit_${ver.Pro}`;
            let code = [];
            
            // モジュールヘッダー
            code.push(`// ${ver.Pro} Auto-Generated Verilog HDL`);
            code.push(`// Generated at: ${new Date().toISOString()}`);
            code.push(`// Physics simulation parameters included as comments`);
            code.push('');
            
            // モジュール宣言
            const inputs = findModuleInputs();
            const outputs = findModuleOutputs();
            
            code.push(`module ${moduleName} (`);
            const ports = [];
            if (inputs.length > 0) ports.push(`    input ${inputs.join(', ')}`);
            if (outputs.length > 0) ports.push(`    output ${outputs.join(', ')}`);
            code.push(ports.join(',\n'));
            code.push(');');
            code.push('');
            
            // 内部信号定義
            const internalWires = findInternalWires();
            if (internalWires.length > 0) {
                internalWires.forEach(wire => {
                    code.push(`    wire ${wire};`);
                });
                code.push('');
            }
            
            // ゲートインスタンス化
            gates.forEach((gate, index) => {
                if (gate.type === 'INPUT' || gate.type === 'OUTPUT') return;
                
                const instanceCode = generateVerilogGateInstance(gate, index);
                if (instanceCode) {
                    code.push(`    // Gate: ${gate.type} (ID: ${gate.id})`);
                    
                    // 物理パラメータコメント
                    const physics = gatePhysics.get(gate.id);
                    if (physics) {
                        code.push(`    // Propagation delay: ${physics.propagationDelay.toFixed(3)}ns`);
                        code.push(`    // Power: ${(physics.power * 1000).toFixed(2)}mW`);
                    }
                    
                    code.push(`    ${instanceCode}`);
                    code.push('');
                }
            });
            
            code.push('endmodule');
            
            return code.join('\n');
        }

        function generateVHDLCode() {
            const entityName = hdlOutput.moduleName || `circuit_${ver.Pro}`;
            let code = [];
            
            // ライブラリとパッケージ
            code.push(`-- ${ver.Pro} Auto-Generated VHDL HDL`);
            code.push(`-- Generated at: ${new Date().toISOString()}`);
            code.push('-- Physics simulation parameters included as comments');
            code.push('');
            code.push('library IEEE;');
            code.push('use IEEE.STD_LOGIC_1164.ALL;');
            code.push('use IEEE.NUMERIC_STD.ALL;');
            code.push('');
            
            // エンティティ宣言
            const inputs = findModuleInputs();
            const outputs = findModuleOutputs();
            
            code.push(`entity ${entityName} is`);
            if (inputs.length > 0 || outputs.length > 0) {
                code.push('    Port (');
                const ports = [];
                inputs.forEach(inp => ports.push(`        ${inp} : in STD_LOGIC`));
                outputs.forEach(out => ports.push(`        ${out} : out STD_LOGIC`));
                code.push(ports.join(';\n'));
                code.push('    );');
            }
            code.push(`end ${entityName};`);
            code.push('');
            
            // アーキテクチャ
            code.push(`architecture Behavioral of ${entityName} is`);
            
            // 内部信号定義
            const internalWires = findInternalWires();
            if (internalWires.length > 0) {
                internalWires.forEach(wire => {
                    code.push(`    signal ${wire} : STD_LOGIC;`);
                });
                code.push('');
            }
            
            code.push('begin');
            code.push('');
            
            // ゲートロジック
            gates.forEach((gate, index) => {
                if (gate.type === 'INPUT' || gate.type === 'OUTPUT') return;
                
                const logicCode = generateVHDLGateLogic(gate, index);
                if (logicCode) {
                    code.push(`    -- Gate: ${gate.type} (ID: ${gate.id})`);
                    
                    // 物理パラメータコメント
                    const physics = gatePhysics.get(gate.id);
                    if (physics) {
                        code.push(`    -- Propagation delay: ${physics.propagationDelay.toFixed(3)}ns`);
                        code.push(`    -- Power: ${(physics.power * 1000).toFixed(2)}mW`);
                    }
                    
                    code.push(`    ${logicCode}`);
                    code.push('');
                }
            });
            
            code.push(`end Behavioral;`);
            
            return code.join('\n');
        }

        function generateVerilogGateInstance(gate, index) {
            const gateName = `gate_${index}`;
            const inputPins = getGateInputSignals(gate);
            const outputPins = getGateOutputSignals(gate);
            
            switch (gate.type) {
                case 'AND':
                    return `and ${gateName} (${outputPins[0]}, ${inputPins.join(', ')});`;
                case 'OR':
                    return `or ${gateName} (${outputPins[0]}, ${inputPins.join(', ')});`;
                case 'NOT':
                    return `not ${gateName} (${outputPins[0]}, ${inputPins[0]});`;
                case 'NAND':
                    return `nand ${gateName} (${outputPins[0]}, ${inputPins.join(', ')});`;
                case 'NOR':
                    return `nor ${gateName} (${outputPins[0]}, ${inputPins.join(', ')});`;
                case 'XOR':
                    return `xor ${gateName} (${outputPins[0]}, ${inputPins.join(', ')});`;
                case 'BUFFER':
                    return `buf ${gateName} (${outputPins[0]}, ${inputPins[0]});`;
                default:
                    // 複雑なゲートはモジュールインスタンス化
                    return `${gate.type.toLowerCase()} ${gateName} (${[...inputPins, ...outputPins].join(', ')});`;
            }
        }

        function generateVHDLGateLogic(gate, index) {
            const outputSignal = getGateOutputSignals(gate)[0];
            const inputSignals = getGateInputSignals(gate);
            
            switch (gate.type) {
                case 'AND':
                    return `${outputSignal} <= ${inputSignals.join(' and ')};`;
                case 'OR':
                    return `${outputSignal} <= ${inputSignals.join(' or ')};`;
                case 'NOT':
                    return `${outputSignal} <= not ${inputSignals[0]};`;
                case 'NAND':
                    return `${outputSignal} <= not (${inputSignals.join(' and ')});`;
                case 'NOR':
                    return `${outputSignal} <= not (${inputSignals.join(' or ')});`;
                case 'XOR':
                    return `${outputSignal} <= ${inputSignals.join(' xor ')};`;
                case 'BUFFER':
                    return `${outputSignal} <= ${inputSignals[0]};`;
                default:
                    return `-- Complex gate ${gate.type} requires custom implementation`;
            }
        }

        function findModuleInputs() {
            return gates.filter(g => g.type === 'INPUT').map(g => `input_${g.id}`);
        }

        function findModuleOutputs() {
            return gates.filter(g => g.type === 'OUTPUT').map(g => `output_${g.id}`);
        }

        function findInternalWires() {
            const wires = new Set();
            connections.forEach(conn => {
                wires.add(`wire_${conn.from.gate.id}_${conn.from.pin}`);
            });
            return Array.from(wires);
        }

        function getGateInputSignals(gate) {
            const signals = [];
            connections.forEach(conn => {
                if (conn.to.gate === gate) {
                    signals[conn.to.pin] = `wire_${conn.from.gate.id}_${conn.from.pin}`;
                }
            });
            // 未接続ピンは'1'b0で初期化
            for (let i = 0; i < gate.inputs.length; i++) {
                if (!signals[i]) signals[i] = `1'b0`;
            }
            return signals;
        }

        function getGateOutputSignals(gate) {
            return gate.outputs.map((_, i) => `wire_${gate.id}_${i}`);
        }

        function downloadTextFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', function(e) {
            keyStates[e.code] = keyStates[e.key] = true;
            updateKeyInputGates();
            if (e.key === 'Delete' && selectedGate) deleteSelected();
            else if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveCircuit(); }
            else if (e.key === 'F5') { e.preventDefault(); simulate(); }
        });
        document.addEventListener('keyup', function(e) {
            keyStates[e.code] = keyStates[e.key] = false;
            updateKeyInputGates();
        });
        
        // ピンハイライトクリア関数
        function clearPinHighlights() {
            document.querySelectorAll('.pin').forEach(p => {
                p.classList.remove('highlight');
                p.style.border = '';
            });
            if (wireStart) {
                if (wireStart.element) wireStart.element.style.border = '';
                wireStart = null;
            }
        }
        
        function getGateDisplayText(gate) {
            // Pro8の表示処理
            if (gate.type === 'KEY_INPUT') return `🎹\n${gate.config.description || gate.config.key}`;
            if (gate.type === 'TIMER_PULSE') return `⏰\n${gate.config.interval}ms`;
            if (gate.type === 'TOGGLE_INPUT') return `🔄\n${gate.config.state ? 'ON' : 'OFF'}`;
            if (gate.type === 'COUNTER_GATE') return `🔢\n${gate.config.count}`;
            if (gate.type === 'LOG_OUTPUT') return '📝\nLOG';
            
            // Pro10設定可能ゲートの表示（設定アイコン付き）
            const configurable = isPro10ConfigurableGate(gate.type);
            const configIcon = configurable ? '' : '';
            
            const displayMap = {
                'INPUT': () => `IN=${gate.userValue || 0}`,
                'OUTPUT': () => `OUT=${gate.value || 0}`,
                'PUSH_BUTTON': () => gate.isPushed ? 'PUSH=1' : 'PUSH=0',
                'TOGGLE_BUTTON': () => `TOG=${gate.userValue || 0}`,
                'DC': () => `${configIcon}DC\n${gate.config && gate.config.voltage ? gate.config.voltage+'V' : (gate.userValue || 0)}`,
                'BUFFER': () => `${configIcon}BUF\n${gate.config && gate.config.delay ? gate.config.delay+'ns' : ''}`,
                'NOT': () => 'NOT', 
                'AND': () => `${configIcon}AND\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'OR': () => `${configIcon}OR\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'NAND': () => `${configIcon}NAND\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'NOR': () => `${configIcon}NOR\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'XOR': () => `${configIcon}XOR\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'XNOR': () => `${configIcon}XNOR\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`,
                'HALF_ADDER': () => 'HA', 'FULL_ADDER': () => 'FA', 
                'BIT4_ADDER': () => `${configIcon}ADD\n${gate.config && gate.config.bits ? gate.config.bits+'bit' : '4bit'}`,
                'COMPLEMENT': () => 'COMP', 'SEG7': () => '7SEG', 'BIT4_7SEG': () => '4→7SEG',
                'D_FF': () => 'D-FF', 'T_FF': () => 'T-FF', 'JK_FF': () => 'JK-FF', 'RS_FF': () => 'RS-FF',
                'BIT_MEMORY': () => 'MEM', 
                'DC': () => `${configIcon}DC\n${gate.config && gate.config.voltage ? gate.config.voltage+'V' : (gate.userValue || 0)}`,
                'RESISTOR': () => `${configIcon}R\n${gate.config && gate.config.resistance ? gate.config.resistance+'Ω' : '1kΩ'}`,
                'OSCILLATOR': () => `${configIcon}OSC\n${gate.config && gate.config.frequency ? gate.config.frequency+'Hz' : ''}`,
                'DELAY': () => `${configIcon}DEL\n${gate.config && gate.config.delayTime ? gate.config.delayTime+gate.config.delayUnit : ''}`,
                'LED': () => `${configIcon}LED\n${gate.config && gate.config.color ? gate.config.color : ''}`,
                'DIODE': () => `${configIcon}DIODE\n${gate.config && gate.config.type ? gate.config.type : ''}`,
                'BUFFER8': () => '8BUF',
                'ALU_181': () => '74HC181', 'DIVIDER4': () => 'DIV4', 'MULTIPLIER4': () => 'MUL4',
                'MEMORY4': () => `${configIcon}MEM4\n${gate.config && gate.config.memorySize ? gate.config.memorySize+'x'+gate.config.dataWidth : ''}`,
                'MEMORY8': () => `${configIcon}MEM8\n${gate.config && gate.config.memorySize ? gate.config.memorySize+'x'+gate.config.dataWidth : ''}`,
                'LED': () => `${configIcon}LED\n${gate.config && gate.config.color ? gate.config.color : ''}`,
                'DIODE': () => `${configIcon}DIODE\n${gate.config && gate.config.type ? gate.config.type : ''}`,
                'COUNTER': () => 'CNT', 'REGISTER': () => 'REG', 'SHIFTREG': () => 'SHIFT',
                'LATCH_SR': () => 'SR', 'LATCH_D': () => 'D-L', 'LATCH_T': () => 'T-L', 'LATCH_JK': () => 'JK-L',
                'COMPARATOR': () => 'CMP', 'ANALOG_SWITCH': () => 'ASW', 'ANALOG_MUX': () => 'AMUX',
                'OSCILLATOR': () => `${configIcon}OSC\n${gate.config && gate.config.frequency ? gate.config.frequency+'Hz' : ''}`,
                'PLL': () => 'PLL', 
                'TRANSISTOR': () => `${configIcon}TR\n${gate.config && gate.config.type ? gate.config.type : ''}`,
                'DECODER': () => `${configIcon}DEC\n${gate.config && gate.config.inputBits ? gate.config.inputBits+'→'+(1<<gate.config.inputBits) : ''}`,
                'ENCODER': () => `${configIcon}ENC\n${gate.config && gate.config.inputBits ? (1<<gate.config.inputBits)+'→'+gate.config.inputBits : ''}`
            };
            
            // 多入力ゲート
            if (gate.type.match(/^(AND|OR|NAND|NOR|XOR|XNOR)\d+$/)) {
                const baseType = gate.type.replace(/\d+$/, '');
                return `${configIcon}${gate.type}\n${gate.config && gate.config.inputPins ? gate.config.inputPins+'in' : ''}`;
            }
            
            // カスタムゲート
            if (gate.type.startsWith('CUSTOM_')) return customGates[gate.type]?.name || gate.type;
            
            return displayMap[gate.type] ? displayMap[gate.type]() : gate.type;
        }
        
        // モバイル対応関数
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const toggle = sidebar.querySelector('.sidebar-toggle');
            
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                toggle.innerHTML = '⚙️ ゲート選択 ▼';
            } else {
                sidebar.classList.add('collapsed');
                toggle.innerHTML = '⚙️ ゲート選択 ▶';
            }
        }
        
        // タッチイベント対応
        function setupTouchEvents() {
            const canvas = document.getElementById('canvas');
            let touchStartTime = 0;
            let touchMoved = false;
            let startX = 0, startY = 0;
            
            // タッチ開始
            canvas.addEventListener('touchstart', function(e) {
                e.preventDefault();
                touchStartTime = Date.now();
                touchMoved = false;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
            }, { passive: false });
            
            // タッチ移動
            canvas.addEventListener('touchmove', function(e) {
                e.preventDefault();
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - startX);
                const deltaY = Math.abs(touch.clientY - startY);
                
                if (deltaX > 10 || deltaY > 10) {
                    touchMoved = true;
                }
            }, { passive: false });
            
            // タッチ終了
            canvas.addEventListener('touchend', function(e) {
                e.preventDefault();
                const touchDuration = Date.now() - touchStartTime;
                
                if (!touchMoved && touchDuration < 300) {
                    // タップとして処理
                    const touch = e.changedTouches[0];
                    const rect = canvas.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    // クリックイベントをシミュレート
                    const clickEvent = new MouseEvent('click', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        offsetX: x,
                        offsetY: y
                    });
                    
                    canvas.dispatchEvent(clickEvent);
                } else if (!touchMoved && touchDuration >= 300) {
                    // 長押しとして処理（右クリック相当）
                    const touch = e.changedTouches[0];
                    const rect = canvas.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    const contextEvent = new MouseEvent('contextmenu', {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        offsetX: x,
                        offsetY: y
                    });
                    
                    canvas.dispatchEvent(contextEvent);
                }
            }, { passive: false });
        }
        
        // 初期化
        function init() {
            // canvas と status は既に定義済みなので代入不要
            
            // イベント設定の統合
            ['click', 'dblclick'].forEach(event => {
                canvas.addEventListener(event, function(e) {
                    e.preventDefault();
                    if (event === 'click') {
                        if (currentMode === 'WIRE') handleWireClick(e);
                        else if (currentMode === 'DELETE') {
                            if (e.target.classList.contains('gate')) deleteGate(parseInt(e.target.dataset.gateId));
                            else if (e.target.classList.contains('wire')) e.target.click();
                        } else if (currentMode && currentMode !== 'SELECT') {
                            addGate(currentMode, e.offsetX, e.offsetY);
                        }
                    }
                });
            });
            
            // ボタンイベント統合
            ['simulate', 'stepSimulate', 'resetSimulation', 'clearAll', 'autoLayout', 'saveCircuit', 'loadCircuit', 'exportImage'].forEach(fn => {
                const btn = document.getElementById(fn.replace(/([A-Z])/g, m => m.toLowerCase()).replace('simulation', '').replace('circuit', '') + 'Btn');
                if (btn) btn.addEventListener('click', window[fn]);
            });
            
            canvas.addEventListener('contextmenu', e => e.preventDefault());
            initializeMemoryComponents();
            setupTouchEvents();
            setMode('SELECT');
        }
        
        // Pro8ゲート判定とメモリ初期化の統合
        function isPro8Gate(t) { return ['KEY_INPUT', 'TIMER_PULSE', 'TOGGLE_INPUT', 'COUNTER_GATE', 'LOG_OUTPUT'].includes(t); }
        
        function initializeMemoryComponents() {
            gates.forEach(g => {
                if (['MEMORY4', 'MEMORY8'].includes(g.type) && !g.memoryData) g.memoryData = {};
                if (g.type === 'COUNTER' && g.counterValue === undefined) {
                    g.counterValue = 0; g.lastClk = 0;
                }
                if (g.type === 'OSCILLATOR' && g.oscillatorState === undefined) g.oscillatorState = false;
            });
        }
        
        // Pro10: ゲート初期設定
        function initializePro10GateConfig(gate, type) {
            // 既に設定がある場合は何もしない
            if (gate.config && Object.keys(gate.config).length > 0) return;
            
            gate.config = gate.config || {};
            
            switch (type) {
                case 'AND': case 'OR': case 'NAND': case 'NOR': case 'XOR': case 'XNOR':
                    gate.config.inputPins = 2;
                    gate.config.delay = 0; // 理想値：遅延なし
                    break;
                case 'BUFFER':
                    gate.config.delay = 0; // 理想値：遅延なし
                    gate.config.driveStrength = 'infinite'; // 理想値：無限駆動力
                    break;
                case 'LED':
                    gate.config.color = 'red';
                    gate.config.brightness = 100; // 理想値：最大輝度
                    break;
                case 'DC':
                    gate.config.voltage = 5.0; // 理想値：固定電圧
                    gate.config.currentLimit = Infinity; // 理想値：電流制限なし
                    gate.config.resistance = 0; // 理想値：内部抵抗ゼロ
                    break;
                case 'OSCILLATOR':
                    gate.config.frequency = 1000; // 1kHz
                    gate.config.waveform = 'square';
                    gate.config.amplitude = 5.0; // 理想値：完全5V
                    gate.config.resistance = 0; // 理想値：内部抵抗ゼロ
                    break;
                case 'DELAY':
                    gate.config.delayTime = 100; // 遅延素子のみ遅延設定可能
                    gate.config.delayUnit = 'ns';
                    break;
                case 'MEMORY4':
                    gate.config.memorySize = 16;
                    gate.config.dataWidth = 4;
                    gate.config.accessTime = 0; // 理想値：瞬時アクセス
                    break;
                case 'MEMORY8':
                    gate.config.memorySize = 256;
                    gate.config.dataWidth = 8;
                    gate.config.accessTime = 0; // 理想値：瞬時アクセス
                    break;
                case 'BIT4_ADDER':
                    gate.config.bits = 4;
                    gate.config.computeTime = 0; // 理想値：瞬時演算
                    break;
                case 'DECODER':
                    gate.config.inputBits = 3;
                    gate.config.delay = 0; // 理想値：遅延なし
                    break;
                case 'ENCODER':
                    gate.config.inputBits = 3;
                    gate.config.delay = 0; // 理想値：遅延なし
                    break;
                case 'TRANSISTOR':
                    gate.config.type = 'npn';
                    gate.config.beta = Infinity; // 理想値：無限増幅率
                    gate.config.vth = 0; // 理想値：閾値電圧なし
                    gate.config.resistance = 0; // 理想値：内部抵抗ゼロ
                    break;
                case 'DIODE':
                    gate.config.vf = 0; // 理想値：順方向電圧降下なし
                    gate.config.maxCurrent = Infinity; // 理想値：電流制限なし
                    gate.config.type = 'ideal';
                    gate.config.resistance = 0; // 理想値：順方向抵抗ゼロ
                    break;
            }
        }

        // Pro10: 設定可能ゲートタイプの定義
        function isPro10ConfigurableGate(type) {
            const configurableGates = [
                // Pro8インタラクティブ
                'KEY_INPUT', 'TIMER_PULSE', 'TOGGLE_INPUT', 'COUNTER_GATE', 'LOG_OUTPUT',
                // 基本論理ゲート
                'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER',
                // アドバンス
                'BIT4_ADDER', 'DECODER', 'ENCODER', 'MUX', 'DEMUX',
                // メモリ・ストレージ
                'MEMORY4', 'MEMORY8', 'BIT_MEMORY', 'REGISTER', 'SHIFTREG',
                // 表示・出力
                'LED', 'SEG7', 'BIT4_7SEG', 'OUTPUT',
                // アナログ・電子部品
                'DC', 'OSCILLATOR', 'DELAY', 'TRANSISTOR', 'DIODE',
                // フリップフロップ・ラッチ
                'D_FF', 'T_FF', 'JK_FF', 'RS_FF', 'LATCH_SR', 'LATCH_D', 'LATCH_T', 'LATCH_JK',
                // カウンタ・比較器
                'COUNTER', 'COMPARATOR',
                // Pro7 ALU・演算
                'ALU_181', 'DIVIDER4', 'MULTIPLIER4',
                // アナログスイッチ・PLL
                'ANALOG_SWITCH', 'ANALOG_MUX', 'PLL'
            ];
            return configurableGates.includes(type);
        }
        
        // 設定ダイアログ表示
        function showConfigDialog(titleOrGate, content = null, callback = null) {
            // 既存のダイアログを全て閉じる
            closeConfigDialog();
            
            // ダイアログオーバーレイ作成
            const overlay = document.createElement('div');
            overlay.id = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); z-index: 99999;
                backdrop-filter: blur(5px);
                display: flex; align-items: center; justify-content: center;
            `;
            
            // ESCキーでダイアログを閉じる
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeConfigDialog();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // 緊急脱出ボタンを追加
            const emergencyButton = document.createElement('button');
            emergencyButton.textContent = '🚨 緊急脱出';
            emergencyButton.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 999999;
                background: #f44336; color: white; border: none; 
                padding: 8px 12px; border-radius: 5px; cursor: pointer;
                font-size: 12px; font-weight: bold;
                box-shadow: 0 2px 8px rgba(244, 67, 54, 0.4);
            `;
            emergencyButton.onclick = () => {
                closeConfigDialog();
                document.removeEventListener('keydown', escapeHandler);
                emergencyButton.remove();
            };
            document.body.appendChild(emergencyButton);
            
            // オーバーレイクリックでダイアログを閉じる
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeConfigDialog();
                    document.removeEventListener('keydown', escapeHandler);
                    emergencyButton.remove();
                }
            });
            
            // ダイアログ作成
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 3px solid #6c757d; border-radius: 16px;
                padding: 0; z-index: 100000; 
                box-shadow: 0 15px 35px rgba(0,0,0,0.4), 0 4px 15px rgba(0,0,0,0.2);
                min-width: 450px; max-width: 650px; max-height: 90vh;
                overflow-y: auto; transform: scale(0.95);
                animation: slideIn 0.3s ease-out forwards;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                position: relative; scroll-behavior: smooth;
            `;
            
            let dialogContent = '';
            
            // 3つの引数の場合（カスタムダイアログ - カスタムゲート作成用）
            if (typeof titleOrGate === 'string' && content && callback) {
                dialogContent = `
                    <div style="padding: 25px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #495057; margin: 0; font-size: 22px; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
                                🔧 ${titleOrGate}
                            </h2>
                            <div style="width: 60px; height: 3px; background: linear-gradient(90deg, #007bff, #28a745); margin: 10px auto; border-radius: 2px;"></div>
                        </div>
                        <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 12px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${content}</div>
                        <div style="margin-top: 25px; text-align: center; padding-bottom: 10px;">
                            <button id="dialogSaveBtn" style="
                                background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                                color: white; border: none; padding: 12px 24px; margin-right: 15px; 
                                border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
                                box-shadow: 0 4px 12px rgba(0,123,255,0.3);
                                transition: all 0.2s ease;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,123,255,0.4)'"
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,123,255,0.3)'">
                                ✨ 保存
                            </button>
                            <button onclick="closeConfigDialog()" style="
                                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                                color: white; border: none; padding: 12px 24px; border-radius: 8px; 
                                cursor: pointer; font-size: 14px; font-weight: 600;
                                box-shadow: 0 4px 12px rgba(108,117,125,0.3);
                                transition: all 0.2s ease;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(108,117,125,0.4)'"
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(108,117,125,0.3)'">
                                ❌ キャンセル
                            </button>
                        </div>
                    </div>
                `;
                
                dialog.innerHTML = dialogContent;
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                
                // 保存ボタンにイベントリスナーを追加
                document.getElementById('dialogSaveBtn').addEventListener('click', function() {
                    try {
                        const result = callback();
                        if (result !== false) closeConfigDialog();
                    } catch(e) {
                        console.error('Callback error:', e);
                        alert('設定エラー: ' + e.message);
                    }
                });
                
            // 1つの引数でゲートオブジェクトの場合（従来の設定ダイアログ）
            } else if (typeof titleOrGate === 'object' && titleOrGate.type) {
                const gate = titleOrGate;
                dialogContent = `
                    <div style="padding: 25px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #495057; margin: 0; font-size: 20px; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
                                ${gate.type} 設定
                            </h2>
                            <div style="width: 50px; height: 3px; background: linear-gradient(90deg, #28a745, #20c997); margin: 10px auto; border-radius: 2px;"></div>
                        </div>
                        <div style="margin: 20px 0;">
                `;
                
                // ゲートタイプ別の設定UI
                switch (gate.type) {
                    case 'KEY_INPUT':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">反応するキー:</label>
                                <select id="keySelect" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="Space" ${gate.config && gate.config.key === 'Space' ? 'selected' : ''}>スペース</option>
                                    <option value="Enter" ${gate.config && gate.config.key === 'Enter' ? 'selected' : ''}>エンター</option>
                                    <option value="Escape" ${gate.config && gate.config.key === 'Escape' ? 'selected' : ''}>ESC</option>
                                    <option value="Tab" ${gate.config && gate.config.key === 'Tab' ? 'selected' : ''}>Tab</option>
                                    <option value="Backspace" ${gate.config && gate.config.key === 'Backspace' ? 'selected' : ''}>Backspace</option>
                                    <option value="Delete" ${gate.config && gate.config.key === 'Delete' ? 'selected' : ''}>Delete</option>
                                    <option value="Insert" ${gate.config && gate.config.key === 'Insert' ? 'selected' : ''}>Insert</option>
                                    <option value="Home" ${gate.config && gate.config.key === 'Home' ? 'selected' : ''}>Home</option>
                                    <option value="End" ${gate.config && gate.config.key === 'End' ? 'selected' : ''}>End</option>
                                    <option value="PageUp" ${gate.config && gate.config.key === 'PageUp' ? 'selected' : ''}>PageUp</option>
                                    <option value="PageDown" ${gate.config && gate.config.key === 'PageDown' ? 'selected' : ''}>PageDown</option>
                                    <option value="ArrowUp" ${gate.config && gate.config.key === 'ArrowUp' ? 'selected' : ''}>↑</option>
                                    <option value="ArrowDown" ${gate.config && gate.config.key === 'ArrowDown' ? 'selected' : ''}>↓</option>
                                    <option value="ArrowLeft" ${gate.config && gate.config.key === 'ArrowLeft' ? 'selected' : ''}>←</option>
                                    <option value="ArrowRight" ${gate.config && gate.config.key === 'ArrowRight' ? 'selected' : ''}>→</option>
                                    <option value="KeyA" ${gate.config && gate.config.key === 'KeyA' ? 'selected' : ''}>A</option>
                                    <option value="KeyB" ${gate.config && gate.config.key === 'KeyB' ? 'selected' : ''}>B</option>
                                    <option value="KeyC" ${gate.config && gate.config.key === 'KeyC' ? 'selected' : ''}>C</option>
                                    <option value="KeyD" ${gate.config && gate.config.key === 'KeyD' ? 'selected' : ''}>D</option>
                                    <option value="KeyE" ${gate.config && gate.config.key === 'KeyE' ? 'selected' : ''}>E</option>
                                    <option value="KeyF" ${gate.config && gate.config.key === 'KeyF' ? 'selected' : ''}>F</option>
                                    <option value="KeyG" ${gate.config && gate.config.key === 'KeyG' ? 'selected' : ''}>G</option>
                                    <option value="KeyH" ${gate.config && gate.config.key === 'KeyH' ? 'selected' : ''}>H</option>
                                    <option value="KeyI" ${gate.config && gate.config.key === 'KeyI' ? 'selected' : ''}>I</option>
                                    <option value="KeyJ" ${gate.config && gate.config.key === 'KeyJ' ? 'selected' : ''}>J</option>
                                    <option value="KeyK" ${gate.config && gate.config.key === 'KeyK' ? 'selected' : ''}>K</option>
                                    <option value="KeyL" ${gate.config && gate.config.key === 'KeyL' ? 'selected' : ''}>L</option>
                                    <option value="KeyM" ${gate.config && gate.config.key === 'KeyM' ? 'selected' : ''}>M</option>
                                    <option value="KeyN" ${gate.config && gate.config.key === 'KeyN' ? 'selected' : ''}>N</option>
                                    <option value="KeyO" ${gate.config && gate.config.key === 'KeyO' ? 'selected' : ''}>O</option>
                                    <option value="KeyP" ${gate.config && gate.config.key === 'KeyP' ? 'selected' : ''}>P</option>
                                    <option value="KeyQ" ${gate.config && gate.config.key === 'KeyQ' ? 'selected' : ''}>Q</option>
                                    <option value="KeyR" ${gate.config && gate.config.key === 'KeyR' ? 'selected' : ''}>R</option>
                                    <option value="KeyS" ${gate.config && gate.config.key === 'KeyS' ? 'selected' : ''}>S</option>
                                    <option value="KeyT" ${gate.config && gate.config.key === 'KeyT' ? 'selected' : ''}>T</option>
                                    <option value="KeyU" ${gate.config && gate.config.key === 'KeyU' ? 'selected' : ''}>U</option>
                                    <option value="KeyV" ${gate.config && gate.config.key === 'KeyV' ? 'selected' : ''}>V</option>
                                    <option value="KeyW" ${gate.config && gate.config.key === 'KeyW' ? 'selected' : ''}>W</option>
                                    <option value="KeyX" ${gate.config && gate.config.key === 'KeyX' ? 'selected' : ''}>X</option>
                                    <option value="KeyY" ${gate.config && gate.config.key === 'KeyY' ? 'selected' : ''}>Y</option>
                                    <option value="KeyZ" ${gate.config && gate.config.key === 'KeyZ' ? 'selected' : ''}>Z</option>
                                    <option value="Digit0" ${gate.config && gate.config.key === 'Digit0' ? 'selected' : ''}>0</option>
                                    <option value="Digit1" ${gate.config && gate.config.key === 'Digit1' ? 'selected' : ''}>1</option>
                                    <option value="Digit2" ${gate.config && gate.config.key === 'Digit2' ? 'selected' : ''}>2</option>
                                    <option value="Digit3" ${gate.config && gate.config.key === 'Digit3' ? 'selected' : ''}>3</option>
                                    <option value="Digit4" ${gate.config && gate.config.key === 'Digit4' ? 'selected' : ''}>4</option>
                                    <option value="Digit5" ${gate.config && gate.config.key === 'Digit5' ? 'selected' : ''}>5</option>
                                    <option value="Digit6" ${gate.config && gate.config.key === 'Digit6' ? 'selected' : ''}>6</option>
                                    <option value="Digit7" ${gate.config && gate.config.key === 'Digit7' ? 'selected' : ''}>7</option>
                                    <option value="Digit8" ${gate.config && gate.config.key === 'Digit8' ? 'selected' : ''}>8</option>
                                    <option value="Digit9" ${gate.config && gate.config.key === 'Digit9' ? 'selected' : ''}>9</option>
                                    <option value="F1" ${gate.config && gate.config.key === 'F1' ? 'selected' : ''}>F1</option>
                                    <option value="F2" ${gate.config && gate.config.key === 'F2' ? 'selected' : ''}>F2</option>
                                    <option value="F3" ${gate.config && gate.config.key === 'F3' ? 'selected' : ''}>F3</option>
                                    <option value="F4" ${gate.config && gate.config.key === 'F4' ? 'selected' : ''}>F4</option>
                                    <option value="F5" ${gate.config && gate.config.key === 'F5' ? 'selected' : ''}>F5</option>
                                    <option value="F6" ${gate.config && gate.config.key === 'F6' ? 'selected' : ''}>F6</option>
                                    <option value="F7" ${gate.config && gate.config.key === 'F7' ? 'selected' : ''}>F7</option>
                                    <option value="F8" ${gate.config && gate.config.key === 'F8' ? 'selected' : ''}>F8</option>
                                    <option value="F9" ${gate.config && gate.config.key === 'F9' ? 'selected' : ''}>F9</option>
                                    <option value="F10" ${gate.config && gate.config.key === 'F10' ? 'selected' : ''}>F10</option>
                                    <option value="F11" ${gate.config && gate.config.key === 'F11' ? 'selected' : ''}>F11</option>
                                    <option value="F12" ${gate.config && gate.config.key === 'F12' ? 'selected' : ''}>F12</option>
                                    <option value="ShiftLeft" ${gate.config && gate.config.key === 'ShiftLeft' ? 'selected' : ''}>Shift (左)</option>
                                    <option value="ShiftRight" ${gate.config && gate.config.key === 'ShiftRight' ? 'selected' : ''}>Shift (右)</option>
                                    <option value="ControlLeft" ${gate.config && gate.config.key === 'ControlLeft' ? 'selected' : ''}>Ctrl (左)</option>
                                    <option value="ControlRight" ${gate.config && gate.config.key === 'ControlRight' ? 'selected' : ''}>Ctrl (右)</option>
                                    <option value="AltLeft" ${gate.config && gate.config.key === 'AltLeft' ? 'selected' : ''}>Alt (左)</option>
                                    <option value="AltRight" ${gate.config && gate.config.key === 'AltRight' ? 'selected' : ''}>Alt (右)</option>
                                    <option value="MetaLeft" ${gate.config && gate.config.key === 'MetaLeft' ? 'selected' : ''}>Win (左)</option>
                                    <option value="MetaRight" ${gate.config && gate.config.key === 'MetaRight' ? 'selected' : ''}>Win (右)</option>
                                    <option value="ContextMenu" ${gate.config && gate.config.key === 'ContextMenu' ? 'selected' : ''}>Menu</option>
                                    <option value="CapsLock" ${gate.config && gate.config.key === 'CapsLock' ? 'selected' : ''}>CapsLock</option>
                                    <option value="NumLock" ${gate.config && gate.config.key === 'NumLock' ? 'selected' : ''}>NumLock</option>
                                    <option value="ScrollLock" ${gate.config && gate.config.key === 'ScrollLock' ? 'selected' : ''}>ScrollLock</option>
                                    <option value="Numpad0" ${gate.config && gate.config.key === 'Numpad0' ? 'selected' : ''}>0</option>
                                    <option value="Numpad1" ${gate.config && gate.config.key === 'Numpad1' ? 'selected' : ''}>1</option>
                                    <option value="Numpad2" ${gate.config && gate.config.key === 'Numpad2' ? 'selected' : ''}>2</option>
                                    <option value="Numpad3" ${gate.config && gate.config.key === 'Numpad3' ? 'selected' : ''}>3</option>
                                    <option value="Numpad4" ${gate.config && gate.config.key === 'Numpad4' ? 'selected' : ''}>4</option>
                                    <option value="Numpad5" ${gate.config && gate.config.key === 'Numpad5' ? 'selected' : ''}>5</option>
                                    <option value="Numpad6" ${gate.config && gate.config.key === 'Numpad6' ? 'selected' : ''}>6</option>
                                    <option value="Numpad7" ${gate.config && gate.config.key === 'Numpad7' ? 'selected' : ''}>7</option>
                                    <option value="Numpad8" ${gate.config && gate.config.key === 'Numpad8' ? 'selected' : ''}>8</option>
                                    <option value="Numpad9" ${gate.config && gate.config.key === 'Numpad9' ? 'selected' : ''}>9</option>
                                    <option value="NumpadAdd" ${gate.config && gate.config.key === 'NumpadAdd' ? 'selected' : ''}>+</option>
                                    <option value="NumpadSubtract" ${gate.config && gate.config.key === 'NumpadSubtract' ? 'selected' : ''}>-</option>
                                    <option value="NumpadMultiply" ${gate.config && gate.config.key === 'NumpadMultiply' ? 'selected' : ''}>*</option>
                                    <option value="NumpadDivide" ${gate.config && gate.config.key === 'NumpadDivide' ? 'selected' : ''}>/</option>
                                    <option value="NumpadDecimal" ${gate.config && gate.config.key === 'NumpadDecimal' ? 'selected' : ''}>.</option>
                                    <option value="NumpadEnter" ${gate.config && gate.config.key === 'NumpadEnter' ? 'selected' : ''}>Enter</option>
                                    <option value="Semicolon" ${gate.config && gate.config.key === 'Semicolon' ? 'selected' : ''}>;</option>
                                    <option value="Equal" ${gate.config && gate.config.key === 'Equal' ? 'selected' : ''}>=</option>
                                    <option value="Comma" ${gate.config && gate.config.key === 'Comma' ? 'selected' : ''}>,</option>
                                    <option value="Minus" ${gate.config && gate.config.key === 'Minus' ? 'selected' : ''}>-</option>
                                    <option value="Period" ${gate.config && gate.config.key === 'Period' ? 'selected' : ''}>.</option>
                                    <option value="Slash" ${gate.config && gate.config.key === 'Slash' ? 'selected' : ''}>/</option>
                                    <option value="Backquote" ${gate.config && gate.config.key === 'Backquote' ? 'selected' : ''}>バッククォート</option>
                                    <option value="BracketLeft" ${gate.config && gate.config.key === 'BracketLeft' ? 'selected' : ''}>[</option>
                                    <option value="Backslash" ${gate.config && gate.config.key === 'Backslash' ? 'selected' : ''}>\\</option>
                                    <option value="BracketRight" ${gate.config && gate.config.key === 'BracketRight' ? 'selected' : ''}>]</option>
                                    <option value="Quote" ${gate.config && gate.config.key === 'Quote' ? 'selected' : ''}>クォート</option>
                                    <option value="PrintScreen" ${gate.config && gate.config.key === 'PrintScreen' ? 'selected' : ''}>PrintScreen</option>
                                    <option value="Pause" ${gate.config && gate.config.key === 'Pause' ? 'selected' : ''}>Pause</option>
                                    <option value="Hiragana" ${gate.config && gate.config.key === 'Hiragana' ? 'selected' : ''}>ひらがな</option>
                                    <option value="KanaMode" ${gate.config && gate.config.key === 'KanaMode' ? 'selected' : ''}>カナ</option>
                                    <option value="Convert" ${gate.config && gate.config.key === 'Convert' ? 'selected' : ''}>変換</option>
                                    <option value="NonConvert" ${gate.config && gate.config.key === 'NonConvert' ? 'selected' : ''}>無変換</option>
                                    <option value="IntlRo" ${gate.config && gate.config.key === 'IntlRo' ? 'selected' : ''}>ろ</option>
                                    <option value="IntlYen" ${gate.config && gate.config.key === 'IntlYen' ? 'selected' : ''}>¥</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">説明:</label>
                                <input type="text" id="keyDescription" value="${gate.config && gate.config.description || ''}" 
                                       placeholder="ゲートの表示名" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                    case 'TIMER_PULSE':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">間隔 (ms):</label>
                                <input type="number" id="timerInterval" value="${gate.config && gate.config.interval || 1000}" 
                                       min="100" max="10000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: flex; align-items: center; font-weight: 600; color: #495057;">
                                    <input type="checkbox" id="timerEnabled" ${gate.config && gate.config.enabled ? 'checked' : ''} 
                                           style="margin-right: 8px; transform: scale(1.2);">自動開始
                                </label>
                            </div>
                        `;
                        break;
                    case 'COUNTER_GATE':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">最大値:</label>
                                <input type="number" id="counterMax" value="${gate.config && gate.config.max || 15}" 
                                       min="1" max="255" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">現在値:</label>
                                <input type="number" id="counterValue" value="${gate.config && gate.config.count || 0}" 
                                       min="0" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                    case 'LOG_OUTPUT':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">最大ログ行数:</label>
                                <input type="number" id="logMaxLines" value="${gate.config && gate.config.maxLines || 20}" 
                                       min="5" max="50" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <button type="button" onclick="clearLog(${gate.id})" style="
                                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                                    color: white; border: none; padding: 8px 16px; border-radius: 6px; 
                                    cursor: pointer; font-size: 14px; font-weight: 600;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='translateY(-1px)'"
                                   onmouseout="this.style.transform='translateY(0)'">
                                    🗑️ ログクリア
                                </button>
                            </div>
                        `;
                        break;
                    case 'TOGGLE_INPUT':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">トグル設定:</label>
                                <p style="color: #6c757d; margin: 10px 0; font-size: 14px;">
                                    このゲートをクリックすることで0と1を切り替えることができます。
                                </p>
                                <div style="display: flex; align-items: center; margin: 10px 0;">
                                    <span style="font-weight: 600; color: #495057;">現在の状態: </span>
                                    <span style="margin-left: 10px; padding: 4px 8px; border-radius: 4px; background: ${gate.userValue ? '#28a745' : '#6c757d'}; color: white; font-weight: bold;">
                                        ${gate.userValue ? 'ON (1)' : 'OFF (0)'}
                                    </span>
                                </div>
                                <button type="button" onclick="
                                    const gate = gates.find(g => g.id === ${gate.id});
                                    gate.userValue = gate.userValue ? 0 : 1;
                                    gate.outputs[0] = gate.userValue;
                                    updateGateDisplay(gate);
                                    closeConfigDialog();
                                " style="
                                    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                                    color: white; border: none; padding: 8px 16px; border-radius: 6px; 
                                    cursor: pointer; font-size: 14px; font-weight: 600;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='translateY(-1px)'"
                                   onmouseout="this.style.transform='translateY(0)'">
                                    トグル切り替え
                                </button>
                            </div>
                        `;
                        break;
                    
                    // Pro10: 基本論理ゲートの設定
                    case 'AND': case 'OR': case 'NAND': case 'NOR': case 'XOR': case 'XNOR':
                        const currentPins = gate.config && gate.config.inputPins || 2;
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">入力ピン数:</label>
                                <input type="number" id="inputPins" value="${currentPins}" 
                                       min="2" max="16" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">遅延時間 (ns):</label>
                                <input type="number" id="propagationDelay" value="${gate.config && gate.config.delay || 10}" 
                                       min="0" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'BUFFER':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">遅延時間 (ns):</label>
                                <input type="number" id="propagationDelay" value="${gate.config && gate.config.delay || 5}" 
                                       min="0" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">駆動能力:</label>
                                <select id="driveStrength" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                                    <option value="low" ${gate.config && gate.config.driveStrength === 'low' ? 'selected' : ''}>低</option>
                                    <option value="medium" ${gate.config && gate.config.driveStrength === 'medium' ? 'selected' : 'selected'}>中 (標準)</option>
                                    <option value="high" ${gate.config && gate.config.driveStrength === 'high' ? 'selected' : ''}>高</option>
                                </select>
                            </div>
                        `;
                        break;
                        
                    case 'LED':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">LED色:</label>
                                <select id="ledColor" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="red" ${gate.config && gate.config.color === 'red' ? 'selected' : ''}>🔴 赤</option>
                                    <option value="green" ${gate.config && gate.config.color === 'green' ? 'selected' : ''}>🟢 緑</option>
                                    <option value="blue" ${gate.config && gate.config.color === 'blue' ? 'selected' : ''}>🔵 青</option>
                                    <option value="yellow" ${gate.config && gate.config.color === 'yellow' ? 'selected' : ''}>🟡 黄</option>
                                    <option value="orange" ${gate.config && gate.config.color === 'orange' ? 'selected' : ''}>🟠 橙</option>
                                    <option value="purple" ${gate.config && gate.config.color === 'purple' ? 'selected' : ''}>🟣 紫</option>
                                    <option value="white" ${gate.config && gate.config.color === 'white' ? 'selected' : ''}>⚪ 白</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">💡輝度:</label>
                                <input type="range" id="ledBrightness" value="${gate.config && gate.config.brightness || 80}" 
                                       min="10" max="100" step="10" style="width: 100%; margin-bottom: 5px;"
                                       oninput="document.getElementById('brightnessValue').textContent = this.value">
                                <span style="font-size: 12px; color: #6c757d;">輝度: <span id="brightnessValue">${gate.config && gate.config.brightness || 80}</span>%</span>
                            </div>
                        `;
                        break;
                        
                    case 'DC':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">電圧 (V):</label>
                                <input type="number" id="dcVoltage" value="${gate.config && gate.config.voltage || 5}" 
                                       min="0" max="24" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">電流制限 (mA):</label>
                                <input type="number" id="currentLimit" value="${gate.config && gate.config.currentLimit || 40}" 
                                       min="1" max="500" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'OSCILLATOR':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">周波数 (Hz):</label>
                                <input type="number" id="frequency" value="${gate.config && gate.config.frequency || 1000}" 
                                       min="1" max="1000000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">波形:</label>
                                <select id="waveform" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="square" ${gate.config && gate.config.waveform === 'square' ? 'selected' : ''}>方形波</option>
                                    <option value="sine" ${gate.config && gate.config.waveform === 'sine' ? 'selected' : ''}>正弦波</option>
                                    <option value="triangle" ${gate.config && gate.config.waveform === 'triangle' ? 'selected' : ''}>三角波</option>
                                    <option value="sawtooth" ${gate.config && gate.config.waveform === 'sawtooth' ? 'selected' : ''}>のこぎり波</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">振幅 (V):</label>
                                <input type="number" id="amplitude" value="${gate.config && gate.config.amplitude || 3.3}" 
                                       min="0.1" max="24" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'DELAY':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">遅延時間:</label>
                                <input type="number" id="delayTime" value="${gate.config && gate.config.delayTime || 100}" 
                                       min="1" max="10000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <select id="delayUnit" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                                    <option value="ns" ${gate.config && gate.config.delayUnit === 'ns' ? 'selected' : ''}>ナノ秒 (ns)</option>
                                    <option value="us" ${gate.config && gate.config.delayUnit === 'us' ? 'selected' : ''}>マイクロ秒 (μs)</option>
                                    <option value="ms" ${gate.config && gate.config.delayUnit === 'ms' ? 'selected' : ''}>ミリ秒 (ms)</option>
                                    <option value="s" ${gate.config && gate.config.delayUnit === 's' ? 'selected' : ''}>秒 (s)</option>
                                </select>
                            </div>
                            </div>
                        `;
                        break;
                        
                    case 'MEMORY4': case 'MEMORY8':
                        const memoryBits = gate.type === 'MEMORY4' ? 4 : 8;
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">メモリサイズ:</label>
                                <input type="number" id="memorySize" value="${gate.config && gate.config.memorySize || (memoryBits === 4 ? 16 : 256)}" 
                                       min="1" max="65536" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">データ幅:</label>
                                <select id="dataWidth" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="4" ${gate.config && gate.config.dataWidth === 4 ? 'selected' : (memoryBits === 4 ? 'selected' : '')}>4ビット</option>
                                    <option value="8" ${gate.config && gate.config.dataWidth === 8 ? 'selected' : (memoryBits === 8 ? 'selected' : '')}>8ビット</option>
                                    <option value="16" ${gate.config && gate.config.dataWidth === 16 ? 'selected' : ''}>16ビット</option>
                                    <option value="32" ${gate.config && gate.config.dataWidth === 32 ? 'selected' : ''}>32ビット</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">アクセス時間 (ns):</label>
                                <input type="number" id="accessTime" value="${gate.config && gate.config.accessTime || (memoryBits === 4 ? 15 : 20)}" 
                                       min="0" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'BIT4_ADDER':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">ビット幅:</label>
                                <select id="adderBits" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="4" ${gate.config && gate.config.bits === 4 ? 'selected' : 'selected'}>4ビット</option>
                                    <option value="8" ${gate.config && gate.config.bits === 8 ? 'selected' : ''}>8ビット</option>
                                    <option value="16" ${gate.config && gate.config.bits === 16 ? 'selected' : ''}>16ビット</option>
                                    <option value="32" ${gate.config && gate.config.bits === 32 ? 'selected' : ''}>32ビット</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">演算時間 (ns):</label>
                                <input type="number" id="computeTime" value="${gate.config && gate.config.computeTime || 25}" 
                                       min="0" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'DECODER': case 'ENCODER':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">入力ビット数:</label>
                                <select id="inputBits" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="2" ${gate.config && gate.config.inputBits === 2 ? 'selected' : ''}>2ビット (4出力)</option>
                                    <option value="3" ${gate.config && gate.config.inputBits === 3 ? 'selected' : 'selected'}>3ビット (8出力)</option>
                                    <option value="4" ${gate.config && gate.config.inputBits === 4 ? 'selected' : ''}>4ビット (16出力)</option>
                                    <option value="5" ${gate.config && gate.config.inputBits === 5 ? 'selected' : ''}>5ビット (32出力)</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">遅延時間 (ns):</label>
                                <input type="number" id="propagationDelay" value="${gate.config && gate.config.delay || (gate.type === 'DECODER' ? 12 : 8)}" 
                                       min="0" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'RESISTOR':
                        const resistorRef = getConfigReference('resistance', gate.type);
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">抵抗値 (Ω):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">${resistorRef}</small>
                                <input type="number" id="resistanceValue" value="${gate.config && gate.config.resistance || 1000}" 
                                       min="1" max="1000000" step="100" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">許容差 (%):</label>
                                <select id="tolerance" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="1" ${gate.config && gate.config.tolerance === 1 ? 'selected' : ''}>±1% (精密)</option>
                                    <option value="5" ${gate.config && gate.config.tolerance === 5 ? 'selected' : 'selected'}>±5% (標準)</option>
                                    <option value="10" ${gate.config && gate.config.tolerance === 10 ? 'selected' : ''}>±10% (一般)</option>
                                    <option value="20" ${gate.config && gate.config.tolerance === 20 ? 'selected' : ''}>±20% (低精度)</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">定格電力 (W):</label>
                                <select id="powerRating" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                                    <option value="0.125" ${gate.config && gate.config.powerRating === 0.125 ? 'selected' : ''}>1/8W</option>
                                    <option value="0.25" ${gate.config && gate.config.powerRating === 0.25 ? 'selected' : 'selected'}>1/4W</option>
                                    <option value="0.5" ${gate.config && gate.config.powerRating === 0.5 ? 'selected' : ''}>1/2W</option>
                                    <option value="1" ${gate.config && gate.config.powerRating === 1 ? 'selected' : ''}>1W</option>
                                    <option value="2" ${gate.config && gate.config.powerRating === 2 ? 'selected' : ''}>2W</option>
                                </select>
                            </div>
                        `;
                        break;
                        
                    case 'DC':
                        const dcVoltageRef = getConfigReference('amplitude', gate.type);
                        const dcCurrentRef = getConfigReference('currentLimit', gate.type);
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">出力電圧 (V):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">${dcVoltageRef}</small>
                                <input type="number" id="dcVoltage" value="${gate.config && gate.config.voltage || 5.0}" 
                                       min="0.1" max="24" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">電流制限 (mA):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">${dcCurrentRef}</small>
                                <input type="number" id="currentLimit" value="${gate.config && gate.config.currentLimit || 100}" 
                                       min="1" max="10000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">内部抵抗 (Ω):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">${getConfigReference('resistance', gate.type)}</small>
                                <input type="number" id="internalResistance" value="${gate.config && gate.config.resistance || 0}" 
                                       min="0" max="1000" step="1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'OSCILLATOR':
                        const oscFreqRef = getConfigReference('frequency', gate.type);
                        const oscAmpRef = getConfigReference('amplitude', gate.type);
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">周波数 (Hz):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">推奨: 1Hz-100kHz</small>
                                <input type="number" id="frequency" value="${gate.config && gate.config.frequency || 1000}" 
                                       min="1" max="100000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">波形:</label>
                                <select id="waveform" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="square" ${gate.config && gate.config.waveform === 'square' ? 'selected' : 'selected'}>方形波</option>
                                    <option value="sine" ${gate.config && gate.config.waveform === 'sine' ? 'selected' : ''}>正弦波</option>
                                    <option value="triangle" ${gate.config && gate.config.waveform === 'triangle' ? 'selected' : ''}>三角波</option>
                                    <option value="sawtooth" ${gate.config && gate.config.waveform === 'sawtooth' ? 'selected' : ''}>ノコギリ波</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">振幅 (V):</label>
                                <small style="color: #6c757d; margin-bottom: 5px; display: block;">${oscAmpRef}</small>
                                <input type="number" id="amplitude" value="${gate.config && gate.config.amplitude || 5.0}" 
                                       min="0.1" max="24" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'DELAY':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">遅延時間:</label>
                                <input type="number" id="delayTime" value="${gate.config && gate.config.delayTime || 100}" 
                                       min="1" max="10000" style="width: 70%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <select id="delayUnit" style="width: 25%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-left: 5%;">
                                    <option value="ns" ${gate.config && gate.config.delayUnit === 'ns' ? 'selected' : 'selected'}>ns</option>
                                    <option value="us" ${gate.config && gate.config.delayUnit === 'us' ? 'selected' : ''}>μs</option>
                                    <option value="ms" ${gate.config && gate.config.delayUnit === 'ms' ? 'selected' : ''}>ms</option>
                                </select>
                                <small style="color: #6c757d; margin-top: 5px; display: block;">遅延素子は信号の伝播遅延をシミュレートします</small>
                            </div>
                        `;
                        break;
                        
                    case 'TRANSISTOR':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">トランジスタタイプ:</label>
                                <select id="transistorType" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                    <option value="npn" ${gate.config && gate.config.type === 'npn' ? 'selected' : 'selected'}>NPN</option>
                                    <option value="pnp" ${gate.config && gate.config.type === 'pnp' ? 'selected' : ''}>PNP</option>
                                    <option value="nmos" ${gate.config && gate.config.type === 'nmos' ? 'selected' : ''}>NMOS</option>
                                    <option value="pmos" ${gate.config && gate.config.type === 'pmos' ? 'selected' : ''}>PMOS</option>
                                </select>
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">増幅率 (β):</label>
                                <input type="number" id="gainBeta" value="${gate.config && gate.config.beta || 200}" 
                                       min="10" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">閾値電圧 (V):</label>
                                <input type="number" id="thresholdVoltage" value="${gate.config && gate.config.vth || 0.7}" 
                                       min="0.1" max="5" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                            </div>
                        `;
                        break;
                        
                    case 'DIODE':
                        dialogContent += `
                            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">順方向電圧 (V):</label>
                                <input type="number" id="forwardVoltage" value="${gate.config && gate.config.vf || 0.7}" 
                                       min="0.1" max="5" step="0.1" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">最大電流 (mA):</label>
                                <input type="number" id="maxCurrent" value="${gate.config && gate.config.maxCurrent || 100}" 
                                       min="1" max="1000" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">ダイオードタイプ:</label>
                                <select id="diodeType" style="width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                                    <option value="standard" ${gate.config && gate.config.type === 'standard' ? 'selected' : 'selected'}>標準</option>
                                    <option value="schottky" ${gate.config && gate.config.type === 'schottky' ? 'selected' : ''}>ショットキー</option>
                                    <option value="zener" ${gate.config && gate.config.type === 'zener' ? 'selected' : ''}>ツェナー</option>
                                    <option value="led" ${gate.config && gate.config.type === 'led' ? 'selected' : ''}>LED</option>
                                </select>
                            </div>
                        `;
                        break;
                }
                
                dialogContent += `
                        </div>
                        <div style="margin-top: 25px; text-align: center; padding-bottom: 10px;">
                            <button onclick="saveGateConfig(${gate.id})" style="
                                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                                color: white; border: none; padding: 12px 24px; margin-right: 15px; 
                                border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
                                box-shadow: 0 4px 12px rgba(40,167,69,0.3);
                                transition: all 0.2s ease;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(40,167,69,0.4)'"
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(40,167,69,0.3)'">
                                ⚙️ 保存
                            </button>
                            <button onclick="closeConfigDialog()" style="
                                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                                color: white; border: none; padding: 12px 24px; border-radius: 8px; 
                                cursor: pointer; font-size: 14px; font-weight: 600;
                                box-shadow: 0 4px 12px rgba(108,117,125,0.3);
                                transition: all 0.2s ease;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(108,117,125,0.4)'"
                               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(108,117,125,0.3)'">
                                ❌ キャンセル
                            </button>
                        </div>
                    </div>
                `;
                
                dialog.innerHTML = dialogContent;
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                
            // エラー
            } else {
                dialogContent = `
                    <div style="padding: 25px; text-align: center;">
                        <div style="margin-bottom: 20px;">
                            <h2 style="color: #dc3545; margin: 0; font-size: 20px; font-weight: 600;">
                                ⚠️ エラー
                            </h2>
                            <div style="width: 50px; height: 3px; background: linear-gradient(90deg, #dc3545, #e74c3c); margin: 10px auto; border-radius: 2px;"></div>
                        </div>
                        <p style="color: #6c757d; margin: 20px 0; font-size: 16px;">設定が見つかりません</p>
                        <button onclick="closeConfigDialog()" style="
                            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                            color: white; border: none; padding: 12px 24px; border-radius: 8px; 
                            cursor: pointer; font-size: 14px; font-weight: 600;
                            box-shadow: 0 4px 12px rgba(220,53,69,0.3);
                            transition: all 0.2s ease;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(220,53,69,0.4)'"
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(220,53,69,0.3)'">
                            閉じる
                        </button>
                    </div>
                `;
                
                dialog.innerHTML = dialogContent;
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
            }
            
            // オーバーレイクリックで閉じる 試験的に無効化
            /*overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    closeConfigDialog();
                }
            });*/
        }
        
        // Pro8：設定ダイアログを閉じる
        function closeConfigDialog() {
            // すべてのダイアログオーバーレイを削除
            document.querySelectorAll('body > div').forEach(overlay => {
                const style = window.getComputedStyle(overlay);
                if (style.position === 'fixed' && 
                    (style.zIndex === '999' || style.zIndex === '9999' || style.zIndex === '10000' || 
                     style.zIndex === '99999' || style.zIndex === '100000' ||
                     overlay.style.cssText.includes('position: fixed'))) {
                    overlay.remove();
                }
            });
            
            // 緊急脱出ボタンも削除
            document.querySelectorAll('button').forEach(btn => {
                if (btn.textContent.includes('🚨 緊急脱出')) {
                    btn.remove();
                }
            });
            
            // 特定のIDを持つオーバーレイも削除
            const specificOverlays = [
                'test-menu-overlay',
                'dialogSaveBtn',
                'dialog-overlay'
            ];
            specificOverlays.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
            
            // bodyのスクロールを復元
            document.body.style.overflow = '';
        }
        
        // Pro10統合版: 全ゲート設定対応
        function initializeUniversalGateConfig(gate, type) {
            if (gate.config && Object.keys(gate.config).length > 0) return;
            
            gate.config = gate.config || {};
            const preset = PRESET_CONFIGS[currentPreset].settings;
            
            // 共通設定
            const commonConfigs = {
                // 論理ゲート系
                'AND': { inputPins: 2, delay: preset.logicDelay },
                'OR': { inputPins: 2, delay: preset.logicDelay },
                'NAND': { inputPins: 2, delay: preset.logicDelay },
                'NOR': { inputPins: 2, delay: preset.logicDelay },
                'XOR': { inputPins: 2, delay: preset.logicDelay },
                'XNOR': { inputPins: 2, delay: preset.logicDelay },
                'NOT': { delay: preset.logicDelay },
                'BUFFER': { delay: preset.logicDelay, driveStrength: preset.driveStrength },
                'BUFFER8': { delay: preset.logicDelay, driveStrength: preset.driveStrength },
                
                // アナログ素子
                'DC': { voltage: 5.0, currentLimit: preset.currentLimit, resistance: preset.resistance },
                'RESISTOR': { resistance: 1000, tolerance: 5, powerRating: 0.25 },
                'OSCILLATOR': { frequency: 1000, waveform: 'square', amplitude: preset.amplitude, resistance: preset.resistance },
                'DELAY': { delayTime: 100, delayUnit: 'ns' },
                'TRANSISTOR': { type: 'npn', beta: preset.beta, vth: preset.vth, resistance: preset.resistance },
                'DIODE': { vf: preset.vf, maxCurrent: preset.currentLimit, type: 'standard', resistance: preset.resistance },
                
                // 表示系
                'LED': { color: 'red', brightness: preset.brightness },
                'SEG7': { brightness: preset.brightness, color: 'red' },
                'BIT4_7SEG': { brightness: preset.brightness, color: 'red' },
                'OUTPUT': { outputType: 'digital', threshold: 2.5 },
                
                // メモリ系
                'MEMORY4': { memorySize: 16, dataWidth: 4, accessTime: preset.memoryAccess },
                'MEMORY8': { memorySize: 256, dataWidth: 8, accessTime: preset.memoryAccess },
                'BIT_MEMORY': { accessTime: preset.memoryAccess },
                'REGISTER': { bits: 4, accessTime: preset.memoryAccess },
                'SHIFTREG': { bits: 4, accessTime: preset.memoryAccess },
                
                // 演算器
                'BIT4_ADDER': { bits: 4, computeTime: preset.logicDelay * 3 },
                'HALF_ADDER': { computeTime: preset.logicDelay * 2 },
                'FULL_ADDER': { computeTime: preset.logicDelay * 2 },
                'COMPLEMENT': { computeTime: preset.logicDelay },
                'ALU_181': { computeTime: preset.logicDelay * 5 },
                'DIVIDER4': { computeTime: preset.logicDelay * 10 },
                'MULTIPLIER4': { computeTime: preset.logicDelay * 8 },
                'COMPARATOR': { computeTime: preset.logicDelay * 2 },
                
                // 複合ゲート
                'MUX': { inputBits: 2, delay: preset.logicDelay * 2 },
                'DEMUX': { inputBits: 2, delay: preset.logicDelay * 2 },
                'ENCODER': { inputBits: 3, delay: preset.logicDelay * 2 },
                'DECODER': { inputBits: 3, delay: preset.logicDelay * 2 },
                'MAJORITY': { delay: preset.logicDelay * 2 },
                'PARITY': { delay: preset.logicDelay },
                
                // フリップフロップ・ラッチ
                'D_FF': { setupTime: preset.logicDelay, holdTime: preset.logicDelay },
                'T_FF': { setupTime: preset.logicDelay, holdTime: preset.logicDelay },
                'JK_FF': { setupTime: preset.logicDelay, holdTime: preset.logicDelay },
                'RS_FF': { setupTime: preset.logicDelay, holdTime: preset.logicDelay },
                'LATCH_SR': { setupTime: preset.logicDelay * 0.5, holdTime: preset.logicDelay * 0.5 },
                'LATCH_D': { setupTime: preset.logicDelay * 0.5, holdTime: preset.logicDelay * 0.5 },
                'LATCH_T': { setupTime: preset.logicDelay * 0.5, holdTime: preset.logicDelay * 0.5 },
                'LATCH_JK': { setupTime: preset.logicDelay * 0.5, holdTime: preset.logicDelay * 0.5 },
                
                // カウンタ・アナログ
                'COUNTER': { maxCount: 15, countMode: 'up' },
                'ANALOG_SWITCH': { resistance: preset.resistance, switchTime: preset.logicDelay },
                'ANALOG_MUX': { resistance: preset.resistance, switchTime: preset.logicDelay },
                'PLL': { lockTime: 1000, frequency: 1000 }
            };
            
            Object.assign(gate.config, commonConfigs[type] || {});
        }
        
        // Pro10統合版: プリセット切り替え
        function switchPreset(newPreset) {
            if (!PRESET_CONFIGS[newPreset]) return;
            
            currentPreset = newPreset;
            
            // 既存ゲートの設定を更新
            gates.forEach(gate => {
                if (currentPreset !== 'custom') {
                    // カスタム以外は設定をリセットして再初期化
                    gate.config = {};
                    initializeUniversalGateConfig(gate, gate.type);
                }
                updateGateDisplay(gate);
            });
            
            status.textContent = `プリセットを${PRESET_CONFIGS[newPreset].name}に変更しました`;
        }
        
        // Pro10統合版: 設定ダイアログ用参考値表示
        function getConfigReference(parameter, gateType) {
            const ideal = PRESET_CONFIGS.ideal.settings;
            const standard = PRESET_CONFIGS.standard.settings;
            
            const referenceMap = {
                delay: `理想値: ${ideal.logicDelay}ns, 業界標準: ${standard.logicDelay}ns (TTL)`,
                resistance: `理想値: ${ideal.resistance}Ω, 業界標準: ${standard.resistance}Ω`,
                currentLimit: `理想値: 無制限, 業界標準: ${standard.currentLimit}mA`,
                brightness: `理想値: ${ideal.brightness}%, 業界標準: ${standard.brightness}%`,
                amplitude: `理想値: ${ideal.amplitude}V, 業界標準: ${standard.amplitude}V (CMOS)`,
                beta: `理想値: 無限大, 業界標準: ${standard.beta}`,
                vth: `理想値: ${ideal.vth}V, 業界標準: ${standard.vth}V (Si接合)`,
                vf: `理想値: ${ideal.vf}V, 業界標準: ${standard.vf}V (Si接合)`,
                memoryAccess: `理想値: ${ideal.memoryAccess}ns, 業界標準: ${standard.memoryAccess}ns (SRAM)`
            };
            
            return referenceMap[parameter] || '';
        }

        // ★ Pro11: プロジェクト管理・バージョン管理機能 ★
        const Pro11ProjectManager = {
            projects: new Map(),
            currentProject: null,
            versionHistory: new Map(),
            
            // プロジェクト作成
            createProject(name, description = '') {
                const project = {
                    id: Date.now(),
                    name: name,
                    description: description,
                    created: new Date(),
                    lastModified: new Date(),
                    circuits: new Map(),
                    tags: [],
                    versions: []
                };
                
                this.projects.set(project.id, project);
                this.currentProject = project.id;
                return project;
            },
            
            // 回路保存（プロジェクト内）
            saveCircuitToProject(circuitName, circuitData) {
                if (!this.currentProject) return false;
                
                const project = this.projects.get(this.currentProject);
                const circuit = {
                    name: circuitName,
                    data: circuitData,
                    created: new Date(),
                    lastModified: new Date(),
                    version: 1
                };
                
                project.circuits.set(circuitName, circuit);
                project.lastModified = new Date();
                
                // バージョン履歴に保存
                this.createVersion(circuitName, circuitData, 'Initial save');
                return true;
            },
            
            // バージョン作成
            createVersion(circuitName, circuitData, comment = '') {
                if (!this.currentProject) return false;
                
                const project = this.projects.get(this.currentProject);
                const version = {
                    id: Date.now(),
                    circuitName: circuitName,
                    data: JSON.parse(JSON.stringify(circuitData)), // ディープコピー
                    timestamp: new Date(),
                    comment: comment,
                    author: 'User'
                };
                
                project.versions.push(version);
                return version.id;
            },
            
            // プロジェクト選択
            selectProject(projectId) {
                if (this.projects.has(projectId)) {
                    this.currentProject = projectId;
                    return true;
                }
                return false;
            },
            
            // 現在のプロジェクト取得
            getCurrentProject() {
                return this.currentProject ? this.projects.get(this.currentProject) : null;
            }
        };

        // Pro11: プロジェクト管理ダイアログ
        function showProjectManager() {
            const projects = Array.from(Pro11ProjectManager.projects.values());
            
            const projectListHTML = projects.length > 0 ? 
                projects.map(project => `
                    <div class="project-item" onclick="selectProject(${project.id})" style="
                        background: white; padding: 15px; margin: 10px 0; border-radius: 8px;
                        border: 2px solid ${Pro11ProjectManager.currentProject === project.id ? '#007bff' : '#dee2e6'};
                        cursor: pointer; transition: all 0.2s ease;
                    " onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                       onmouseout="this.style.boxShadow='none'">
                        <h4 style="margin: 0 0 8px 0; color: #495057;">${project.name}</h4>
                        <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 14px;">${project.description}</p>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #868e96;">
                            <span>${project.circuits.size} 回路</span>
                            <span>${project.lastModified.toLocaleDateString()}</span>
                            <span>${project.versions.length} バージョン</span>
                        </div>
                    </div>
                `).join('') :
                `<div style="text-align: center; padding: 40px; color: #6c757d;">
                    <p>プロジェクトがありません</p>
                    <p>新しいプロジェクトを作成してください</p>
                </div>`;

            showConfigDialog('プロジェクト管理', `
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    ${projectListHTML}
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                    <h5 style="margin: 0 0 15px 0; color: #495057;">新しいプロジェクト</h5>
                    <input type="text" id="newProjectName" placeholder="プロジェクト名" style="
                        width: 100%; padding: 10px; margin-bottom: 10px;
                        border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;
                    ">
                    <textarea id="newProjectDescription" placeholder="説明" rows="2" style="
                        width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; 
                        font-size: 14px; resize: vertical;
                    "></textarea>
                </div>
            `, function() {
                const name = document.getElementById('newProjectName').value.trim();
                const description = document.getElementById('newProjectDescription').value.trim();
                
                if (name) {
                    const project = Pro11ProjectManager.createProject(name, description);
                    status.textContent = `プロジェクト "${name}" を作成しました`;
                    return true;
                } else {
                    alert('プロジェクト名を入力してください');
                    return false;
                }
            });
        }

        // プロジェクト選択
        function selectProject(projectId) {
            Pro11ProjectManager.selectProject(projectId);
            status.textContent = `プロジェクト "${Pro11ProjectManager.getCurrentProject().name}" を選択しました`;
        }

        // Pro11: スナップショット機能
        function createSnapshot() {
            if (!Pro11ProjectManager.currentProject) {
                alert('プロジェクトを選択してください');
                return;
            }
            
            showConfigDialog('スナップショット作成', `
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">
                        スナップショット名:
                    </label>
                    <input type="text" id="snapshotName" placeholder="例: 基本回路完成" style="
                        width: 100%; padding: 10px; margin-bottom: 15px;
                        border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;
                    ">
                    
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">
                        コメント:
                    </label>
                    <textarea id="snapshotComment" placeholder="変更内容や注意点を記録..." rows="3" style="
                        width: 100%; padding: 10px; border: 2px solid #dee2e6; border-radius: 6px; 
                        font-size: 14px; resize: vertical;
                    "></textarea>
                    
                    <div style="background: #e3f2fd; padding: 10px; border-radius: 6px; margin-top: 15px;">
                        <small style="color: #1976d2;">
                            現在の回路状況:<br>
                            • ゲート数: ${gates.length}<br>
                            • 配線数: ${wires.length}<br>
                            • 最終更新: ${new Date().toLocaleString()}
                        </small>
                    </div>
                </div>
            `, function() {
                const name = document.getElementById('snapshotName').value.trim();
                const comment = document.getElementById('snapshotComment').value.trim();
                
                if (!name) {
                    alert('スナップショット名を入力してください');
                    return false;
                }
                
                const circuitData = {
                    gates: gates.map(gate => ({
                        id: gate.id, type: gate.type, x: gate.x, y: gate.y,
                        userValue: gate.userValue, config: gate.config
                    })),
                    wires: wires.map(wire => ({
                        id: wire.id, outputGate: wire.outputGate, outputPin: wire.outputPin,
                        inputGate: wire.inputGate, inputPin: wire.inputPin
                    })),
                    metadata: {
                        created: new Date(),
                        gateCount: gates.length,
                        wireCount: wires.length
                    }
                };
                
                const versionId = Pro11ProjectManager.createVersion(name, circuitData, comment);
                if (versionId) {
                    status.textContent = `スナップショット "${name}" を作成しました`;
                    return true;
                } else {
                    alert('スナップショットの作成に失敗しました');
                    return false;
                }
            });
        }

        // Pro11: バージョン履歴表示
        function showVersionHistory() {
            if (!Pro11ProjectManager.currentProject) {
                alert('プロジェクトを選択してください');
                return;
            }
            
            const project = Pro11ProjectManager.projects.get(Pro11ProjectManager.currentProject);
            const versions = [...project.versions].reverse(); // 新しい順
            
            const versionListHTML = versions.length > 0 ?
                versions.map((version, index) => `
                    <div class="version-item" style="
                        background: white; padding: 12px; margin: 8px 0; border-radius: 6px;
                        border-left: 4px solid ${index === 0 ? '#28a745' : '#6c757d'};
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h5 style="margin: 0; color: #495057;">${version.circuitName}</h5>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="loadVersion(${version.id})" style="
                                    background: #007bff; color: white; border: none; padding: 4px 8px;
                                    border-radius: 4px; font-size: 12px; cursor: pointer;
                                ">復元</button>
                                <button onclick="previewVersion(${version.id})" style="
                                    background: #6c757d; color: white; border: none; padding: 4px 8px;
                                    border-radius: 4px; font-size: 12px; cursor: pointer;
                                ">プレビュー</button>
                            </div>
                        </div>
                        <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 13px;">${version.comment}</p>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #868e96;">
                            <span>${version.author}</span>
                            <span>${version.timestamp.toLocaleString()}</span>
                            <span>${version.data.gates?.length || 0} ゲート</span>
                        </div>
                    </div>
                `).join('') :
                `<div style="text-align: center; padding: 40px; color: #6c757d;">
                    <p>バージョン履歴がありません</p>
                    <p>スナップショットを作成してください</p>
                </div>`;

            showConfigDialog('バージョン履歴', `
                <div style="max-height: 500px; overflow-y: auto;">
                    ${versionListHTML}
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-top: 15px; border: 1px solid #ffeaa7;">
                    <small style="color: #856404;">
                        <strong>ヒント:</strong> 復元すると現在の回路が置き換えられます。
                        事前にスナップショットを作成することをお勧めします。
                    </small>
                </div>
            `, function() {
                return true; // 閉じるだけ
            });
        }

        // バージョン復元
        function loadVersion(versionId) {
            if (!confirm('現在の回路を置き換えますか？\n（事前にスナップショットを作成することをお勧めします）')) {
                return;
            }
            
            const project = Pro11ProjectManager.projects.get(Pro11ProjectManager.currentProject);
            const version = project.versions.find(v => v.id === versionId);
            
            if (version) {
                // 現在の回路をクリア
                clearAll();
                
                // バージョンデータを復元
                const data = version.data;
                
                // ゲートを復元
                data.gates.forEach(gData => {
                    const spec = GATE_SPECS[gData.type];
                    if (spec) {
                        addGate(gData.type, gData.x, gData.y);
                        const gate = gates[gates.length - 1];
                        Object.assign(gate, {
                            id: gData.id, 
                            userValue: gData.userValue, 
                            config: gData.config || {}
                        });
                        if (gate.userValue !== null) gate.value = gate.userValue;
                        updateGateDisplay(gate);
                    }
                });
                
                // 配線を復元
                setTimeout(() => {
                    data.wires.forEach(wData => {
                        const outputGate = gates.find(g => g.id === wData.outputGate);
                        const inputGate = gates.find(g => g.id === wData.inputGate);
                        if (outputGate && inputGate) {
                            createWire(outputGate, wData.outputPin, inputGate, wData.inputPin);
                        }
                    });
                    
                    closeConfigDialog();
                    status.textContent = `バージョン "${version.circuitName}" を復元しました`;
                }, 100);
            }
        }

        // バージョンプレビュー
        function previewVersion(versionId) {
            const project = Pro11ProjectManager.projects.get(Pro11ProjectManager.currentProject);
            const version = project.versions.find(v => v.id === versionId);
            
            if (version) {
                const data = version.data;
                const gateCount = data.gates?.length || 0;
                const wireCount = data.wires?.length || 0;
                
                alert(`バージョン詳細: ${version.circuitName}\n\n` +
                      `作成日時: ${version.timestamp.toLocaleString()}\n` +
                      `作成者: ${version.author}\n` +
                      `ゲート数: ${gateCount}\n` +
                      `配線数: ${wireCount}\n\n` +
                      `コメント: ${version.comment || 'なし'}`);
            }
        }

        // 初期化時にプロジェクトマネージャを初期化
        function initPro() {
            // デフォルトプロジェクトを作成
            const defaultProject = Pro11ProjectManager.createProject(
                'デフォルトプロジェクト', 
                'Logic Gate Pro12のデフォルトプロジェクトです'
            );
            
            status.textContent = 'Logic Gate Pro12 - プロジェクト管理・バージョン管理対応版。プロジェクトボタンから管理できます。';
        }

        // Pro11 Project Management UI functions
        function exportCurrentProject() {
            if (!pro11Manager.currentProject) {
                alert('プロジェクトが選択されていません。');
                return;
            }
            
            const project = pro11Manager.projects.get(pro11Manager.currentProject);
            const exportData = {
                name: project.name,
                description: project.description,
                versions: Array.from(project.versions.values())
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.name}_export.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function importProject() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const importData = JSON.parse(e.target.result);
                        
                        // Create new project with imported data
                        const projectId = 'proj_' + Date.now();
                        const project = {
                            id: projectId,
                            name: importData.name + '_imported',
                            description: importData.description || '',
                            created: new Date().toISOString(),
                            versions: new Map()
                        };
                        
                        // Import versions
                        importData.versions.forEach(version => {
                            const versionId = 'ver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                            project.versions.set(versionId, {
                                ...version,
                                id: versionId
                            });
                        });
                        
                        pro11Manager.projects.set(projectId, project);
                        pro11Manager.saveToStorage();
                        
                        alert(`プロジェクト "${project.name}" がインポートされました。`);
                        showProjectManager();
                        
                    } catch (error) {
                        alert('ファイルの読み込みに失敗しました: ' + error.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        // Update current project info display
        function updateCurrentProjectDisplay() {
            const nameSpan = document.getElementById('current-project-name');
            const versionSpan = document.getElementById('current-version');
            
            if (nameSpan && versionSpan) {
                if (pro11Manager.currentProject) {
                    const project = pro11Manager.projects.get(pro11Manager.currentProject);
                    nameSpan.textContent = project ? project.name : 'Unknown';
                    
                    if (pro11Manager.currentVersion) {
                        const version = project ? project.versions.get(pro11Manager.currentVersion) : null;
                        versionSpan.textContent = version ? version.name : 'Unknown';
                    } else {
                        versionSpan.textContent = 'Working';
                    }
                } else {
                    nameSpan.textContent = 'None';
                    versionSpan.textContent = '-';
                }
            }
        }

        // ★ Pro12: 回路テスト・検証機能 ★
        const Pro12TestManager = {
            testResults: new Map(),
            testHistory: [],
            isRunning: false,

            // 自動テスト実行
            runAutoTest: function() {
                if (this.isRunning) {
                    alert('テストが既に実行中です。');
                    return;
                }

                this.isRunning = true;
                const testId = 'test_' + Date.now();
                const testResult = {
                    id: testId,
                    timestamp: new Date().toISOString(),
                    type: 'auto',
                    gates: gates.length,
                    wires: wires.length,
                    results: {}
                };

                // 各入力パターンをテスト
                const inputGates = gates.filter(g => g.type === 'INPUT');
                const outputGates = gates.filter(g => g.type === 'OUTPUT');
                
                if (inputGates.length === 0 || outputGates.length === 0) {
                    alert('入力ゲートまたは出力ゲートが見つかりません。');
                    this.isRunning = false;
                    return;
                }

                const totalPatterns = Math.pow(2, inputGates.length);
                testResult.results.patterns = [];

                for (let i = 0; i < totalPatterns; i++) {
                    // 入力パターン設定
                    for (let j = 0; j < inputGates.length; j++) {
                        inputGates[j].state = (i >> j) & 1;
                    }

                    // 回路の状態を更新
                    simulate();

                    // 結果を記録
                    const pattern = {
                        input: inputGates.map(g => g.state),
                        output: outputGates.map(g => g.state)
                    };
                    testResult.results.patterns.push(pattern);
                }

                this.testResults.set(testId, testResult);
                this.testHistory.push(testResult);
                this.isRunning = false;

                status.textContent = `自動テスト完了: ${totalPatterns}パターンをテストしました`;
                return testResult;
            },

            // 真理値表生成（完全機能版）
            generateTruthTable: function() {
                const inputGates = gates.filter(g => g.type === 'INPUT');
                const outputGates = gates.filter(g => g.type === 'OUTPUT');
                
                if (inputGates.length === 0 || outputGates.length === 0) {
                    return null;
                }

                const table = {
                    inputs: inputGates.map((g, i) => `In${i}`),
                    outputs: outputGates.map((g, i) => `Out${i}`),
                    rows: []
                };

                const totalPatterns = Math.pow(2, Math.min(inputGates.length, 8)); // 最大8入力
                
                for (let i = 0; i < totalPatterns; i++) {
                    try {
                        // 全ゲート状態をリセット
                        gates.forEach(gate => {
                            gate.value = undefined;
                            gate.state = undefined;
                            gate.processed = false;
                        });
                        
                        // 入力設定（MSBから順番）
                        for (let j = 0; j < inputGates.length; j++) {
                            const bit = (i >> (inputGates.length - 1 - j)) & 1;
                            inputGates[j].state = bit;
                            inputGates[j].value = bit;
                            inputGates[j].processed = true;
                        }

                        // 段階的シミュレーション（安定化まで）
                        let changed = true;
                        let iterations = 0;
                        const maxIterations = 100;
                        
                        while (changed && iterations < maxIterations) {
                            changed = false;
                            iterations++;
                            
                            gates.forEach(gate => {
                                if (gate.type === 'INPUT' || gate.processed) return;
                                
                                const inputWires = wires.filter(w => w.endGateId === gate.id);
                                if (inputWires.length === 0) return;
                                
                                const inputValues = inputWires.map(wire => {
                                    const sourceGate = gates.find(g => g.id === wire.startGateId);
                                    return sourceGate && sourceGate.value !== undefined ? sourceGate.value : 0;
                                });
                                
                                // 入力が揃わない場合はスキップ
                                if (inputValues.some(v => v === undefined)) return;
                                
                                const oldValue = gate.value;
                                
                                // ゲート演算
                                switch (gate.type) {
                                    case 'AND':
                                        gate.value = inputValues.every(v => v === 1) ? 1 : 0;
                                        break;
                                    case 'OR':
                                        gate.value = inputValues.some(v => v === 1) ? 1 : 0;
                                        break;
                                    case 'NOT':
                                        gate.value = inputValues[0] === 1 ? 0 : 1;
                                        break;
                                    case 'NAND':
                                        gate.value = inputValues.every(v => v === 1) ? 0 : 1;
                                        break;
                                    case 'NOR':
                                        gate.value = inputValues.some(v => v === 1) ? 0 : 1;
                                        break;
                                    case 'XOR':
                                        gate.value = inputValues.reduce((a, b) => a ^ b, 0);
                                        break;
                                    case 'D_FF':
                                        // クロック・データ入力を考慮した簡易実装
                                        if (inputValues.length >= 2) {
                                            const clk = inputValues[0];
                                            const d = inputValues[1];
                                            if (clk === 1) {
                                                gate.value = d;
                                            } else {
                                                gate.value = gate.value || 0; // 保持
                                            }
                                        } else {
                                            gate.value = inputValues[0] || 0;
                                        }
                                        break;
                                    case 'FULL_ADDER':
                                        if (inputValues.length >= 3) {
                                            const a = inputValues[0] || 0;
                                            const b = inputValues[1] || 0;
                                            const cin = inputValues[2] || 0;
                                            gate.value = a ^ b ^ cin; // Sum
                                        } else {
                                            gate.value = inputValues.reduce((a, b) => a ^ b, 0);
                                        }
                                        break;
                                    case 'MUX':
                                        if (inputValues.length >= 3) {
                                            const sel = inputValues[0];
                                            gate.value = sel ? inputValues[2] : inputValues[1];
                                        } else {
                                            gate.value = inputValues[0] || 0;
                                        }
                                        break;
                                    default:
                                        gate.value = inputValues[0] || 0;
                                }
                                
                                gate.state = gate.value;
                                gate.processed = true;
                                
                                if (oldValue !== gate.value) {
                                    changed = true;
                                }
                            });
                        }
                        
                        // 出力値を収集
                        const outputValues = outputGates.map(g => {
                            // 出力ゲートに接続された前段ゲートの値
                            const inputWires = wires.filter(w => w.endGateId === g.id);
                            if (inputWires.length > 0) {
                                const sourceGate = gates.find(gate => gate.id === inputWires[0].startGateId);
                                if (sourceGate && sourceGate.value !== undefined) {
                                    return sourceGate.value;
                                }
                            }
                            return g.value !== undefined ? g.value : 0;
                        });

                        // 結果記録
                        table.rows.push({
                            inputs: inputGates.map(g => g.state || 0),
                            outputs: outputValues
                        });
                        
                    } catch (error) {
                        console.error(`真理値表生成エラー (パターン${i}):`, error);
                        // エラー時はデフォルト値
                        table.rows.push({
                            inputs: inputGates.map((g, j) => (i >> (inputGates.length - 1 - j)) & 1),
                            outputs: outputGates.map(() => 0)
                        });
                    }
                }

                return table;
            },

            // ストレステスト
            runStressTest: function() {
                if (this.isRunning) {
                    alert('テストが既に実行中です。');
                    return;
                }

                this.isRunning = true;
                const testId = 'stress_' + Date.now();
                const startTime = performance.now();
                
                const iterations = 10000;
                const inputGates = gates.filter(g => g.type === 'INPUT');
                
                for (let i = 0; i < iterations; i++) {
                    // ランダム入力設定
                    inputGates.forEach(g => {
                        g.state = Math.random() > 0.5 ? 1 : 0;
                    });
                    simulate();
                }

                const endTime = performance.now();
                const duration = endTime - startTime;

                const stressResult = {
                    id: testId,
                    timestamp: new Date().toISOString(),
                    type: 'stress',
                    iterations: iterations,
                    duration: duration,
                    performance: iterations / duration * 1000 // iterations per second
                };

                this.testResults.set(testId, stressResult);
                this.testHistory.push(stressResult);
                this.isRunning = false;

                status.textContent = `ストレステスト完了: ${iterations}回実行、${duration.toFixed(2)}ms、${stressResult.performance.toFixed(0)} iter/sec`;
                return stressResult;
            }
        };

        // Pro12 UI Functions
        function startAutoTest() {
            const result = Pro12TestManager.runAutoTest();
            if (result) {
                setTimeout(() => showTestResults(), 500);
            }
        }

        function showTruthTable() {
            const table = Pro12TestManager.generateTruthTable();
            if (!table) {
                alert('入力ゲートまたは出力ゲートが見つかりません。');
                return;
            }

            let html = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                     background: white; border: 2px solid #007bff; border-radius: 8px; padding: 20px; 
                     z-index: 10000; max-height: 80vh; overflow-y: auto; min-width: 400px;">
                    <h3 style="margin-top: 0; color: #007bff;">真理値表</h3>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                ${table.inputs.map(input => `<th style="border: 1px solid #dee2e6; padding: 8px;">${input}</th>`).join('')}
                                <th style="border: 1px solid #dee2e6; padding: 8px; background: #e3f2fd;">|</th>
                                ${table.outputs.map(output => `<th style="border: 1px solid #dee2e6; padding: 8px; background: #fff3cd;">${output}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${table.rows.map(row => `
                                <tr>
                                    ${row.inputs.map(val => `<td style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">${val}</td>`).join('')}
                                    <td style="border: 1px solid #dee2e6; padding: 8px; background: #e3f2fd; text-align: center;">|</td>
                                    ${row.outputs.map(val => `<td style="border: 1px solid #dee2e6; padding: 8px; text-align: center; background: ${val ? '#d4edda' : '#f8d7da'};">${val}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="text-align: right; margin-top: 15px;">
                        <button onclick="this.parentElement.parentElement.remove()" 
                                style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            閉じる
                        </button>
                    </div>
                </div>
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" 
                     onclick="this.nextElementSibling.remove(); this.remove();"></div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', html);
        }

        // Pro12 Smart Test Menu Dialog
        function showTestMenu() {
            let html = `
                <div id="test-menu-dialog" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                     background: white; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; 
                     z-index: 10000; min-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                     animation: slideIn 0.3s ease-out;">
                    <h3 style="margin-top: 0; color: #dc3545; display: flex; align-items: center;">
                        <span style="font-size: 24px; margin-right: 10px;"></span>
                        回路テスト・検証メニュー
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                        <!-- Auto Test -->
                        <div style="border: 2px solid #007bff; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s;"
                             onclick="startAutoTest(); closeTestMenu();"
                             onmouseover="this.style.background='#f0f8ff'; this.style.transform='scale(1.02)'"
                             onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
                            <div style="font-weight: bold; color: #007bff; text-align: center; margin-bottom: 5px;">自動テスト</div>
                            <div style="font-size: 12px; color: #666; text-align: center;">
                                全入力パターンを自動生成<br>
                                論理回路の動作を完全検証
                            </div>
                        </div>

                        <!-- Truth Table -->
                        <div style="border: 2px solid #6f42c1; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s;"
                             onclick="showTruthTable(); closeTestMenu();"
                             onmouseover="this.style.background='#f8f5ff'; this.style.transform='scale(1.02)'"
                             onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
                            <div style="font-weight: bold; color: #6f42c1; text-align: center; margin-bottom: 5px;">真理値表</div>
                            <div style="font-size: 12px; color: #666; text-align: center;">
                                入出力の関係を表形式で表示<br>
                                論理関数の確認に最適
                            </div>
                        </div>

                        <!-- Stress Test -->
                        <div style="border: 2px solid #fd7e14; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s;"
                             onclick="performStressTest(); closeTestMenu();"
                             onmouseover="this.style.background='#fff8f0'; this.style.transform='scale(1.02)'"
                             onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
                            <div style="font-weight: bold; color: #fd7e14; text-align: center; margin-bottom: 5px;">ストレステスト</div>
                            <div style="font-size: 12px; color: #666; text-align: center;">
                                高速ランダム入力で性能測定<br>
                                回路の安定性をチェック
                            </div>
                        </div>

                        <!-- Test Results -->
                        <div style="border: 2px solid #20c997; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.2s;"
                             onclick="showTestResults(); closeTestMenu();"
                             onmouseover="this.style.background='#f0fdf8'; this.style.transform='scale(1.02)'"
                             onmouseout="this.style.background='white'; this.style.transform='scale(1)'">
                            <div style="font-weight: bold; color: #20c997; text-align: center; margin-bottom: 5px;">テスト結果</div>
                            <div style="font-size: 12px; color: #666; text-align: center;">
                                過去のテスト履歴を確認<br>
                                パフォーマンス分析
                            </div>
                        </div>
                    </div>

                    <!-- Circuit Info -->
                    <div style="background: #f8f9fa; border-radius: 6px; padding: 12px; margin: 15px 0;">
                        <div style="font-weight: bold; margin-bottom: 5px; color: #495057;">現在の回路情報</div>
                        <div style="font-size: 12px; color: #666;">
                            ゲート数: <span style="color: #007bff; font-weight: bold;">${gates.length}</span> | 
                            配線数: <span style="color: #28a745; font-weight: bold;">${wires.length}</span> | 
                            入力: <span style="color: #dc3545; font-weight: bold;">${gates.filter(g => g.type === 'INPUT').length}</span> | 
                            出力: <span style="color: #fd7e14; font-weight: bold;">${gates.filter(g => g.type === 'OUTPUT').length}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: right; margin-top: 20px;">
                        <button onclick="closeTestMenu()" 
                                style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            キャンセル
                        </button>
                    </div>
                </div>
                <div id="test-menu-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" 
                     onclick="closeTestMenu();"></div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', html);
        }

        function closeTestMenu() {
            // IDで直接削除
            const dialog = document.getElementById('test-menu-dialog');
            const overlay = document.getElementById('test-menu-overlay');
            
            if (dialog) dialog.remove();
            if (overlay) overlay.remove();
        }

        function performStressTest() {
            const result = Pro12TestManager.runStressTest();
            if (result) {
                setTimeout(() => showTestResults(), 500);
            }
        }

        function showTestResults() {
            const results = Pro12TestManager.testHistory;
            if (results.length === 0) {
                alert('テスト結果がありません。まずテストを実行してください。');
                return;
            }

            let html = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                     background: white; border: 2px solid #28a745; border-radius: 8px; padding: 20px; 
                     z-index: 10000; max-height: 80vh; overflow-y: auto; min-width: 600px;">
                    <h3 style="margin-top: 0; color: #28a745;">テスト結果</h3>
                    
                    <div style="max-height: 500px; overflow-y: auto;">
                        ${results.slice(-10).reverse().map(result => `
                            <div style="border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin: 8px 0; background: #f8f9fa;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong style="color: ${result.type === 'auto' ? '#007bff' : '#fd7e14'};">
                                        ${result.type === 'auto' ? '自動テスト' : 'ストレステスト'}
                                    </strong>
                                    <span style="font-size: 12px; color: #666;">
                                        ${new Date(result.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                
                                <div style="margin-top: 8px; font-size: 14px;">
                                    ${result.type === 'auto' ? `
                                        <div>ゲート数: ${result.gates}, 配線数: ${result.wires}</div>
                                        <div>テストパターン: ${result.results.patterns ? result.results.patterns.length : 0}パターン</div>
                                    ` : `
                                        <div>実行回数: ${result.iterations.toLocaleString()}回</div>
                                        <div>実行時間: ${result.duration.toFixed(2)}ms</div>
                                        <div>パフォーマンス: ${result.performance.toFixed(0)} iter/sec</div>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="text-align: right; margin-top: 15px;">
                        <button onclick="Pro12TestManager.testHistory = []; this.parentElement.parentElement.remove()" 
                                style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">
                            履歴クリア
                        </button>
                        <button onclick="this.parentElement.parentElement.remove()" 
                                style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            閉じる
                        </button>
                    </div>
                </div>
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" 
                     onclick="this.nextElementSibling.remove(); this.remove();"></div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', html);
        }

        // 初期化実行
        document.addEventListener('DOMContentLoaded', function() {
            init();
            initPro();
            
            // Update project display periodically
            setInterval(updateCurrentProjectDisplay, 1000);
            
            // Initial display update
            setTimeout(updateCurrentProjectDisplay, 100);
        });

        // Pro13 AI支援機能
        function showAIAssistant() {
            showConfigDialog('AI支援アシスタント', `
                <div style="background: linear-gradient(135deg, #9c27b0 0%, #e91e63 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; box-shadow: 0 4px 15px rgba(156, 39, 176, 0.3);">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 300;">🤖 AI支援アシスタント</h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">あなたの回路設計をサポートします</p>
                </div>
                
                <div style="display: grid; gap: 15px; padding: 5px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border-left: 4px solid #9c27b0;">
                        <h4 style="margin: 0 0 10px 0; color: #9c27b0;">💡 回路提案</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">現在の回路を分析し、改善案を提案します</p>
                        <button onclick="executeAICircuitAnalysis()" style="margin-top: 10px; padding: 8px 16px; background: #9c27b0; color: white; border: none; border-radius: 5px; cursor: pointer;">分析開始</button>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border-left: 4px solid #e91e63;">
                        <h4 style="margin: 0 0 10px 0; color: #e91e63;">🔧 自動最適化</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">回路の配置とルーティングを自動最適化</p>
                        <button onclick="executeAIOptimization()" style="margin-top: 10px; padding: 8px 16px; background: #e91e63; color: white; border: none; border-radius: 5px; cursor: pointer;">最適化実行</button>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; border-left: 4px solid #673ab7;">
                        <h4 style="margin: 0 0 10px 0; color: #673ab7;">📚 学習リソース</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">関連する回路設計の学習材料を提案</p>
                        <button onclick="showLearningResources()" style="margin-top: 10px; padding: 8px 16px; background: #673ab7; color: white; border: none; border-radius: 5px; cursor: pointer;">リソース表示</button>
                    </div>
                </div>
            `, function() { return true; });
        }

        function showSmartDesign() {
            showConfigDialog('スマート設計', `
                <div style="background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; box-shadow: 0 4px 15px rgba(255, 87, 34, 0.3);">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 300;">🎨 スマート設計</h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">AIによる自動回路設計</p>
                </div>
                
                <div style="display: grid; gap: 15px; padding: 5px;">
                    <div style="background: #fff3e0; padding: 15px; border-radius: 10px; border-left: 4px solid #ff5722;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #e65100;">設計要求</label>
                        <textarea id="designRequirement" placeholder="例: 4bitカウンタを作成してください" rows="3" style="width: 100%; padding: 10px; border: 2px solid #ffcc02; border-radius: 5px; font-size: 14px;"></textarea>
                        <button onclick="executeAIDesign()" style="margin-top: 10px; padding: 10px 20px; background: #ff5722; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">AI設計開始</button>
                    </div>
                    
                    <div style="background: #fff8e1; padding: 15px; border-radius: 10px; border-left: 4px solid #ff9800;">
                        <h4 style="margin: 0 0 10px 0; color: #f57c00;">⚡ クイック設計</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <button onclick="generateCounterCircuit(); closeConfigDialog();" style="padding: 8px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">カウンタ</button>
                            <button onclick="generateALUCircuit(); closeConfigDialog();" style="padding: 8px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">ALU</button>
                            <button onclick="generateMemoryCircuit(); closeConfigDialog();" style="padding: 8px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">メモリ</button>
                            <button onclick="generateCPUCircuit(); closeConfigDialog();" style="padding: 8px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer;">CPU</button>
                        </div>
                    </div>
                </div>
            `, function() { return true; });
        }

        function showCircuitAnalyzer() {
            showConfigDialog('回路解析', `
                <div style="background: linear-gradient(135deg, #795548 0%, #8d6e63 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; box-shadow: 0 4px 15px rgba(121, 85, 72, 0.3);">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 300;">🔍 回路解析</h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">高度な回路分析と診断</p>
                </div>
                
                <div style="display: grid; gap: 15px; padding: 5px;">
                    <div style="background: #efebe9; padding: 15px; border-radius: 10px; border-left: 4px solid #795548;">
                        <h4 style="margin: 0 0 10px 0; color: #5d4037;">📊 性能分析</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">回路の遅延、消費電力、面積を分析</p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <button onclick="executeDelayAnalysis(); closeConfigDialog();" style="padding: 6px; background: #795548; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">遅延分析</button>
                            <button onclick="executePowerAnalysis(); closeConfigDialog();" style="padding: 6px; background: #795548; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">電力分析</button>
                        </div>
                    </div>
                    
                    <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; border-left: 4px solid #8d6e63;">
                        <h4 style="margin: 0 0 10px 0; color: #6d4c41;">🐛 エラー検出</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">論理エラーや設計不備を自動検出</p>
                        <button onclick="executeErrorDetection(); closeConfigDialog();" style="padding: 8px 16px; background: #8d6e63; color: white; border: none; border-radius: 5px; cursor: pointer;">エラーチェック</button>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 10px; border-left: 4px solid #a1887f;">
                        <h4 style="margin: 0 0 10px 0; color: #795548;">📈 最適化提案</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">回路改善案を自動生成</p>
                        <button onclick="generateOptimizationSuggestions(); closeConfigDialog();" style="padding: 8px 16px; background: #a1887f; color: white; border: none; border-radius: 5px; cursor: pointer;">改善案生成</button>
                    </div>
                </div>
            `, function() { return true; });
        }

        function showSmartGateWizard() {
            showConfigDialog('スマートゲート作成', `
                <div style="background: linear-gradient(135deg, #607d8b 0%, #78909c 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; box-shadow: 0 4px 15px rgba(96, 125, 139, 0.3);">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 300;">⚡ スマートゲート作成</h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">AIによる高度なゲート自動生成</p>
                </div>
                
                <div style="display: grid; gap: 15px; padding: 5px;">
                    <div style="background: #eceff1; padding: 15px; border-radius: 10px; border-left: 4px solid #607d8b;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #37474f;">機能説明</label>
                        <textarea id="smartGateDescription" placeholder="例: 入力信号を遅延させて出力するゲート" rows="2" style="width: 100%; padding: 10px; border: 2px solid #b0bec5; border-radius: 5px; font-size: 14px;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div style="background: #e1f5fe; padding: 10px; border-radius: 8px; border-left: 3px solid #01579b;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #01579b; font-size: 12px;">入力数</label>
                            <input id="smartGateInputs" type="number" min="1" max="16" value="2" style="width: 100%; padding: 6px; border: 1px solid #81d4fa; border-radius: 4px;">
                        </div>
                        
                        <div style="background: #fff3e0; padding: 10px; border-radius: 8px; border-left: 3px solid #e65100;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #e65100; font-size: 12px;">出力数</label>
                            <input id="smartGateOutputs" type="number" min="1" max="16" value="1" style="width: 100%; padding: 6px; border: 1px solid #ffcc02; border-radius: 4px;">
                        </div>
                    </div>
                    
                    <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; border-left: 4px solid #78909c;">
                        <h4 style="margin: 0 0 10px 0; color: #546e7a;">🧠 AI生成オプション</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <button onclick="generateFromTruthTable()" style="padding: 8px; background: #78909c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">真理値表生成</button>
                            <button onclick="generateFromLogicExpression()" style="padding: 8px; background: #78909c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">論理式生成</button>
                            <button onclick="generateOptimizedGate()" style="padding: 8px; background: #78909c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">最適化生成</button>
                            <button onclick="generateFromHDL()" style="padding: 8px; background: #78909c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">HDL生成</button>
                        </div>
                    </div>
                    
                    <button onclick="executeSmartGateGeneration()" style="padding: 12px 24px; background: #607d8b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-top: 10px;">🚀 AI生成開始</button>
                </div>
            `, function() { return true; });
        }

        // Pro13 AI Manager - 強化版
        class Pro13AIManager {
            constructor() {
                this.analysisHistory = [];
                this.optimizationSuggestions = [];
                this.designPatterns = new Map();
                this.learningResources = new Map();
                this.circuitDatabase = new Map();
                this.aiModels = new Map();
                this.knowledgeBase = new Map();
                this.performanceMetrics = new Map();
                this.initializeAI();
            }

            initializeAI() {
                this.initializePatterns();
                this.initializeLearningResources();
                this.initializeAIModels();
                this.initializeKnowledgeBase();
                this.initializeCircuitDatabase();
            }

            initializePatterns() {
                // 基本パターン
                this.designPatterns.set('counter', {
                    name: '4bitカウンタ',
                    gates: [
                        'INPUT', // 0: CLK
                        'INPUT', // 1: RESET
                        'D_FF',  // 2: Q0
                        'D_FF',  // 3: Q1
                        'D_FF',  // 4: Q2
                        'D_FF',  // 5: Q3
                        'OUTPUT', // 6: Q0
                        'OUTPUT', // 7: Q1
                        'OUTPUT', // 8: Q2
                        'OUTPUT'  // 9: Q3
                    ],
                    wires: [
                        // CLK to all FF
                        {from:0,fromPin:0,to:2,toPin:1},
                        {from:0,fromPin:0,to:3,toPin:1},
                        {from:0,fromPin:0,to:4,toPin:1},
                        {from:0,fromPin:0,to:5,toPin:1},
                        // RESET to all FF
                        {from:1,fromPin:0,to:2,toPin:2},
                        {from:1,fromPin:0,to:3,toPin:2},
                        {from:1,fromPin:0,to:4,toPin:2},
                        {from:1,fromPin:0,to:5,toPin:2},
                        // Q cascade (Qn to Dn+1)
                        {from:2,fromPin:0,to:3,toPin:0},
                        {from:3,fromPin:0,to:4,toPin:0},
                        {from:4,fromPin:0,to:5,toPin:0},
                        // Q outputs
                        {from:2,fromPin:0,to:6,toPin:0},
                        {from:3,fromPin:0,to:7,toPin:0},
                        {from:4,fromPin:0,to:8,toPin:0},
                        {from:5,fromPin:0,to:9,toPin:0}
                    ],
                    description: '4bitバイナリカウンタ回路',
                    complexity: 'medium',
                    power: 2.5,
                    area: 12,
                    delay: 3.2,
                    reliability: 0.95
                });
                
                this.designPatterns.set('alu', {
                    name: '4bit ALU with Multiple Operations',
                    gates: [
                        'INPUT', 'INPUT', 'INPUT', 'INPUT', // 0-3: A0-A3
                        'INPUT', 'INPUT', 'INPUT', 'INPUT', // 4-7: B0-B3
                        'INPUT', 'INPUT', // 8-9: Op0, Op1 (operation select)
                        'INPUT', // 10: CarryIn
                        // Logic operations
                        'AND', 'AND', 'AND', 'AND', // 11-14: A&B per bit
                        'OR', 'OR', 'OR', 'OR',     // 15-18: A|B per bit
                        'XOR', 'XOR', 'XOR', 'XOR', // 19-22: A^B per bit
                        'NOT', 'NOT', 'NOT', 'NOT', // 23-26: ~A per bit
                        // Arithmetic operations
                        'FULL_ADDER', 'FULL_ADDER', 'FULL_ADDER', 'FULL_ADDER', // 27-30: addition
                        // Output multiplexers
                        'MUX', 'MUX', 'MUX', 'MUX', // 31-34: result selection
                        'OUTPUT', 'OUTPUT', 'OUTPUT', 'OUTPUT', // 35-38: Result0-3
                        'OUTPUT', 'OUTPUT' // 39-40: Carry, Zero flag
                    ],
                    wires: [
                        // A&B operations
                        {from:0,fromPin:0,to:11,toPin:0}, {from:4,fromPin:0,to:11,toPin:1},
                        {from:1,fromPin:0,to:12,toPin:0}, {from:5,fromPin:0,to:12,toPin:1},
                        {from:2,fromPin:0,to:13,toPin:0}, {from:6,fromPin:0,to:13,toPin:1},
                        {from:3,fromPin:0,to:14,toPin:0}, {from:7,fromPin:0,to:14,toPin:1},
                        // A|B operations
                        {from:0,fromPin:0,to:15,toPin:0}, {from:4,fromPin:0,to:15,toPin:1},
                        {from:1,fromPin:0,to:16,toPin:0}, {from:5,fromPin:0,to:16,toPin:1},
                        {from:2,fromPin:0,to:17,toPin:0}, {from:6,fromPin:0,to:17,toPin:1},
                        {from:3,fromPin:0,to:18,toPin:0}, {from:7,fromPin:0,to:18,toPin:1},
                        // A^B operations
                        {from:0,fromPin:0,to:19,toPin:0}, {from:4,fromPin:0,to:19,toPin:1},
                        {from:1,fromPin:0,to:20,toPin:0}, {from:5,fromPin:0,to:20,toPin:1},
                        {from:2,fromPin:0,to:21,toPin:0}, {from:6,fromPin:0,to:21,toPin:1},
                        {from:3,fromPin:0,to:22,toPin:0}, {from:7,fromPin:0,to:22,toPin:1},
                        // ~A operations
                        {from:0,fromPin:0,to:23,toPin:0}, {from:1,fromPin:0,to:24,toPin:0},
                        {from:2,fromPin:0,to:25,toPin:0}, {from:3,fromPin:0,to:26,toPin:0},
                        // Addition A+B
                        {from:0,fromPin:0,to:27,toPin:0}, {from:4,fromPin:0,to:27,toPin:1},
                        {from:10,fromPin:0,to:27,toPin:2}, // CarryIn to FA0
                        {from:1,fromPin:0,to:28,toPin:0}, {from:5,fromPin:0,to:28,toPin:1},
                        {from:27,fromPin:1,to:28,toPin:2}, // Carry chain
                        {from:2,fromPin:0,to:29,toPin:0}, {from:6,fromPin:0,to:29,toPin:1},
                        {from:28,fromPin:1,to:29,toPin:2},
                        {from:3,fromPin:0,to:30,toPin:0}, {from:7,fromPin:0,to:30,toPin:1},
                        {from:29,fromPin:1,to:30,toPin:2},
                        // MUX selections (Op0, Op1 control which result)
                        {from:11,fromPin:0,to:31,toPin:0}, {from:15,fromPin:0,to:31,toPin:1}, // AND/OR to MUX0
                        {from:19,fromPin:0,to:31,toPin:2}, {from:27,fromPin:0,to:31,toPin:3}, // XOR/ADD to MUX0
                        {from:8,fromPin:0,to:31,toPin:8}, {from:9,fromPin:0,to:31,toPin:9}, // Op select
                        // Similar for other bits...
                        {from:31,fromPin:0,to:35,toPin:0}, // MUX result to output
                        {from:30,fromPin:1,to:39,toPin:0} // Final carry out
                    ],
                    description: '4bit多機能ALU (AND, OR, XOR, NOT, ADD演算対応)',
                    complexity: 'very_high',
                    power: 8.5,
                    area: 45,
                    delay: 6.2,
                    reliability: 0.88
                });
                
                this.designPatterns.set('memory', {
                    name: '8bitレジスタファイル',
                    gates: [
                        'INPUT', 'INPUT', // 0: CLK, 1: WE
                        'INPUT', 'INPUT', 'INPUT', // 2-4: Addr(3bit)
                        'INPUT', // 5: DataIn
                        'D_FF', 'D_FF', 'D_FF', 'D_FF', 'D_FF', 'D_FF', 'D_FF', 'D_FF', // 6-13: 8bit Reg
                        'DECODER', // 14: 3to8
                        'MUX', // 15: 8to1
                        'OUTPUT' // 16: DataOut
                    ],
                    wires: [
                        // Addr to DECODER
                        {from:2,fromPin:0,to:14,toPin:0},
                        {from:3,fromPin:0,to:14,toPin:1},
                        {from:4,fromPin:0,to:14,toPin:2},
                        // DECODER to D_FF WE
                        {from:14,fromPin:0,to:6,toPin:2},
                        {from:14,fromPin:1,to:7,toPin:2},
                        {from:14,fromPin:2,to:8,toPin:2},
                        {from:14,fromPin:3,to:9,toPin:2},
                        {from:14,fromPin:4,to:10,toPin:2},
                        {from:14,fromPin:5,to:11,toPin:2},
                        {from:14,fromPin:6,to:12,toPin:2},
                        {from:14,fromPin:7,to:13,toPin:2},
                        // CLK to all D_FF
                        {from:0,fromPin:0,to:6,toPin:1},
                        {from:0,fromPin:0,to:7,toPin:1},
                        {from:0,fromPin:0,to:8,toPin:1},
                        {from:0,fromPin:0,to:9,toPin:1},
                        {from:0,fromPin:0,to:10,toPin:1},
                        {from:0,fromPin:0,to:11,toPin:1},
                        {from:0,fromPin:0,to:12,toPin:1},
                        {from:0,fromPin:0,to:13,toPin:1},
                        // DataIn to all D_FF D
                        {from:5,fromPin:0,to:6,toPin:0},
                        {from:5,fromPin:0,to:7,toPin:0},
                        {from:5,fromPin:0,to:8,toPin:0},
                        {from:5,fromPin:0,to:9,toPin:0},
                        {from:5,fromPin:0,to:10,toPin:0},
                        {from:5,fromPin:0,to:11,toPin:0},
                        {from:5,fromPin:0,to:12,toPin:0},
                        {from:5,fromPin:0,to:13,toPin:0},
                        // D_FF Q to MUX
                        {from:6,fromPin:0,to:15,toPin:0},
                        {from:7,fromPin:0,to:15,toPin:1},
                        {from:8,fromPin:0,to:15,toPin:2},
                        {from:9,fromPin:0,to:15,toPin:3},
                        {from:10,fromPin:0,to:15,toPin:4},
                        {from:11,fromPin:0,to:15,toPin:5},
                        {from:12,fromPin:0,to:15,toPin:6},
                        {from:13,fromPin:0,to:15,toPin:7},
                        // Addr to MUX
                        {from:2,fromPin:0,to:15,toPin:8},
                        {from:3,fromPin:0,to:15,toPin:9},
                        {from:4,fromPin:0,to:15,toPin:10},
                        // MUX out to OUTPUT
                        {from:15,fromPin:0,to:16,toPin:0}
                    ],
                    description: '8bitレジスタファイル with アドレスデコーダ',
                    complexity: 'high',
                    power: 4.2,
                    area: 20,
                    delay: 2.8,
                    reliability: 0.97
                });

                // 高度なパターン
                this.designPatterns.set('cpu_core', {
                    name: '簡易CPUコア',
                    gates: ['ALU_181', 'MEMORY8', 'COUNTER', 'DECODER', 'MUX', 'DEMUX'],
                    description: '基本的なCPUコア（ALU + メモリ + 制御）',
                    complexity: 'very_high',
                    power: 12.5,
                    area: 48,
                    delay: 6.7,
                    reliability: 0.89
                });

                this.designPatterns.set('dsp_filter', {
                    name: 'デジタルフィルタ',
                    gates: ['MULTIPLIER4', 'FULL_ADDER', 'FULL_ADDER', 'D_FF', 'D_FF'],
                    description: 'FIRデジタルフィルタ',
                    complexity: 'high',
                    power: 7.3,
                    area: 28,
                    delay: 5.1,
                    reliability: 0.94
                });
            }

            initializeLearningResources() {
                this.learningResources.set('基本論理ゲート', [
                    'AND, OR, NOT ゲートは論理回路の基本要素です',
                    'NAND, NOR ゲートは万能ゲートとして知られています',
                    'XOR ゲートは排他的論理和を実現し、加算器で重要な役割を果たします',
                    'バッファゲートは信号の増幅と遅延調整に使用されます'
                ]);
                
                this.learningResources.set('フリップフロップ', [
                    'D-FFは最も基本的な記憶素子で、1bitの情報を保存できます',
                    'T-FFはトグル動作を行い、分周器やカウンタに使用されます',
                    'JK-FFは多機能なフリップフロップで、すべての動作モードをサポートします',
                    'RS-FFはセット・リセット機能を持つ最も基本的なラッチです'
                ]);
                
                this.learningResources.set('組み合わせ回路', [
                    'エンコーダ・デコーダは符号変換回路で、データの圧縮・展開に使用されます',
                    'マルチプレクサは複数の入力から1つを選択する回路です',
                    '加算器は算術演算の基本回路で、CPUのALUの核となります',
                    'コンパレータは2つの数値の大小関係を判定します'
                ]);

                this.learningResources.set('高度な設計技法', [
                    'パイプライン化により処理能力を向上させることができます',
                    'クロックドメイン分離により、異なる周波数の回路を安全に接続できます',
                    'ガードバンド設計により、ノイズ耐性を向上させることができます',
                    'パワーゲーティングにより消費電力を削減できます'
                ]);

                this.learningResources.set('最適化手法', [
                    'ド・モルガンの法則を適用してゲート数を削減できます',
                    'カルノー図を使用して論理式を簡略化できます',
                    'クリティカルパス最適化により動作周波数を向上させられます',
                    'レジスタバランシングによりパイプライン効率を最適化できます'
                ]);
            }

            initializeAIModels() {
                // 回路分析AI
                this.aiModels.set('circuit_analyzer', {
                    type: 'analysis',
                    accuracy: 0.94,
                    confidence: 0.87,
                    trainingData: 'circuit_patterns_v2.1'
                });

                // 最適化AI
                this.aiModels.set('optimizer', {
                    type: 'optimization',
                    accuracy: 0.91,
                    confidence: 0.83,
                    trainingData: 'optimization_rules_v1.8'
                });

                // 設計生成AI
                this.aiModels.set('design_generator', {
                    type: 'generation',
                    accuracy: 0.89,
                    confidence: 0.81,
                    trainingData: 'design_patterns_v3.0'
                });

                // エラー検出AI
                this.aiModels.set('error_detector', {
                    type: 'detection',
                    accuracy: 0.96,
                    confidence: 0.92,
                    trainingData: 'error_patterns_v1.5'
                });
            }

            initializeKnowledgeBase() {
                // 設計ルール
                this.knowledgeBase.set('design_rules', {
                    'fanout_limit': 4,
                    'max_path_depth': 10,
                    'min_setup_time': 0.5,
                    'max_power_density': 2.0,
                    'min_noise_margin': 0.3
                });

                // パフォーマンス基準
                this.knowledgeBase.set('performance_targets', {
                    'max_delay': 5.0,
                    'max_power': 10.0,
                    'max_area': 100,
                    'min_reliability': 0.95,
                    'max_temperature': 85
                });

                // 最適化戦略
                this.knowledgeBase.set('optimization_strategies', {
                    'area_optimization': ['gate_sharing', 'logic_minimization', 'resource_sharing'],
                    'power_optimization': ['clock_gating', 'power_gating', 'voltage_scaling'],
                    'speed_optimization': ['pipeline_insertion', 'parallel_processing', 'path_balancing'],
                    'reliability_optimization': ['redundancy', 'error_correction', 'robust_design']
                });
            }

            initializeCircuitDatabase() {
                // 既知の回路パターンのデータベース
                this.circuitDatabase.set('common_patterns', [
                    { pattern: 'ripple_carry_adder', efficiency: 0.7, area: 'low', speed: 'medium' },
                    { pattern: 'carry_lookahead_adder', efficiency: 0.9, area: 'high', speed: 'high' },
                    { pattern: 'wallace_tree_multiplier', efficiency: 0.85, area: 'very_high', speed: 'very_high' },
                    { pattern: 'barrel_shifter', efficiency: 0.8, area: 'medium', speed: 'high' }
                ]);
            }

            analyzeCircuit() {
                const analysis = {
                    gateCount: gates.length,
                    wireCount: wires.length,
                    complexity: this.calculateComplexity(),
                    suggestions: this.generateSuggestions(),
                    gateTypes: this.analyzeGateTypes(),
                    criticalPath: this.calculateCriticalPath(),
                    powerEstimate: this.estimatePower(),
                    areaEstimate: this.estimateArea()
                };
                
                this.analysisHistory.push(analysis);
                return analysis;
            }

            calculateComplexity() {
                // 回路の複雑度計算（ゲート数とファンアウトベース）
                let complexity = gates.length;
                gates.forEach(gate => {
                    const fanout = wires.filter(w => w.outputGate === gate.id).length;
                    complexity += fanout * 0.5;
                });
                return Math.round(complexity);
            }

            generateSuggestions() {
                const suggestions = [];
                
                if (gates.length > 20) {
                    suggestions.push('回路が大きいです。モジュール化を検討してください。');
                }
                
                const inputGates = gates.filter(g => g.type === 'INPUT').length;
                const outputGates = gates.filter(g => g.type === 'OUTPUT').length;
                
                if (inputGates === 0) {
                    suggestions.push('入力ゲートがありません。');
                }
                if (outputGates === 0) {
                    suggestions.push('出力ゲートがありません。');
                }
                
                return suggestions;
            }

            analyzeGateTypes() {
                const types = {};
                gates.forEach(gate => {
                    types[gate.type] = (types[gate.type] || 0) + 1;
                });
                return types;
            }

            calculateCriticalPath() {
                // 簡易クリティカルパス計算
                const visited = new Set();
                let maxDepth = 0;
                
                function dfs(gateId, depth) {
                    if (visited.has(gateId)) return depth;
                    visited.add(gateId);
                    
                    const outWires = wires.filter(w => w.outputGate === gateId);
                    let maxChildDepth = depth;
                    
                    outWires.forEach(wire => {
                        const childDepth = dfs(wire.inputGate, depth + 1);
                        maxChildDepth = Math.max(maxChildDepth, childDepth);
                    });
                    
                    return maxChildDepth;
                }
                
                gates.forEach(gate => {
                    if (gate.type === 'INPUT') {
                        const depth = dfs(gate.id, 0);
                        maxDepth = Math.max(maxDepth, depth);
                    }
                });
                
                return maxDepth;
            }

            estimatePower() {
                // 簡易電力推定（ゲート数ベース）
                let power = 0;
                gates.forEach(gate => {
                    switch(gate.type) {
                        case 'AND':
                        case 'OR':
                        case 'NOT':
                        case 'NAND':
                        case 'NOR':
                        case 'XOR':
                            power += 0.1; // mW
                            break;
                        case 'D_FF':
                            power += 0.5; // mW
                            break;
                        case 'FULL_ADDER':
                            power += 0.3; // mW
                            break;
                        default:
                            power += 0.05; // mW
                    }
                });
                return Math.round(power * 100) / 100;
            }

            estimateArea() {
                // 簡易面積推定（ゲート数ベース）
                let area = 0;
                gates.forEach(gate => {
                    switch(gate.type) {
                        case 'D_FF':
                            area += 4; // 相対単位
                            break;
                        case 'FULL_ADDER':
                            area += 3;
                            break;
                        default:
                            area += 1;
                    }
                });
                return area;
            }

            calculateBasicMetrics() {
                const gateTypes = {};
                let inputCount = 0;
                let outputCount = 0;
                
                gates.forEach(gate => {
                    gateTypes[gate.type] = (gateTypes[gate.type] || 0) + 1;
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON', 'DC'].includes(gate.type)) {
                        inputCount++;
                    }
                    if (gate.type === 'OUTPUT') {
                        outputCount++;
                    }
                });
                
                return {
                    gateCount: gates.length,
                    wireCount: wires.length,
                    inputCount: inputCount,
                    outputCount: outputCount,
                    gateTypes: gateTypes
                };
            }

            performTopologicalAnalysis() {
                const levels = this.calculateCircuitLevels();
                const fanoutAnalysis = this.analyzeFanout();
                const connectivityAnalysis = this.analyzeConnectivity();
                
                return {
                    maxLevels: levels.maxLevels,
                    levelDistribution: levels.distribution,
                    averageFanout: fanoutAnalysis.average,
                    maxFanout: fanoutAnalysis.max,
                    connectivityIndex: connectivityAnalysis.index,
                    isolatedNodes: connectivityAnalysis.isolated,
                    stronglyConnectedComponents: this.findStronglyConnectedComponents()
                };
            }

            performTimingAnalysis() {
                const criticalPath = this.calculateAdvancedCriticalPath();
                const setupTimes = this.calculateSetupTimes();
                const clockSkew = this.estimateClockSkew();
                
                return {
                    criticalPathDelay: criticalPath.delay,
                    criticalPathGates: criticalPath.gates,
                    maxFrequency: criticalPath.delay > 0 ? (1000 / criticalPath.delay).toFixed(1) : 'N/A',
                    setupMargin: setupTimes.margin,
                    clockSkew: clockSkew,
                    timingViolations: this.identifyTimingViolations(),
                    slackAnalysis: this.performSlackAnalysis()
                };
            }

            performPowerAnalysis() {
                const staticPower = this.calculateStaticPower();
                const dynamicPower = this.calculateDynamicPower();
                const powerHotspots = this.identifyPowerHotspots();
                
                return {
                    staticPower: staticPower,
                    dynamicPower: dynamicPower,
                    totalPower: staticPower + dynamicPower,
                    powerDensity: this.calculatePowerDensity(),
                    hotspots: powerHotspots,
                    powerEfficiency: this.calculatePowerEfficiency(),
                    batteryLife: this.estimateBatteryLife(staticPower + dynamicPower)
                };
            }

            performReliabilityAnalysis() {
                const mtbf = this.calculateMTBF();
                const singlePointFailures = this.identifySinglePointFailures();
                const redundancy = this.analyzeRedundancy();
                
                return {
                    mtbf: mtbf,
                    reliability: Math.exp(-1000 / mtbf), // 1000時間後の信頼性
                    singlePointFailures: singlePointFailures,
                    redundancyLevel: redundancy.level,
                    faultTolerance: redundancy.faultTolerant,
                    errorDetectionCoverage: this.calculateErrorDetectionCoverage()
                };
            }

            performThermalAnalysis() {
                const thermalMap = this.generateThermalMap();
                const hotspots = this.identifyThermalHotspots();
                
                return {
                    maxTemperature: thermalMap.max,
                    averageTemperature: thermalMap.average,
                    hotspots: hotspots,
                    thermalGradient: thermalMap.gradient,
                    coolingRequirement: this.calculateCoolingRequirement(thermalMap.max)
                };
            }

            // === AI解析メソッド ===
            performPatternRecognition() {
                const recognizedPatterns = [];
                
                // 既知のパターンをスキャン
                this.designPatterns.forEach((pattern, name) => {
                    const confidence = this.matchPattern(pattern.gates);
                    if (confidence > 0.7) {
                        recognizedPatterns.push({
                            name: name,
                            confidence: confidence,
                            description: pattern.description,
                            optimization: this.suggestPatternOptimization(name)
                        });
                    }
                });
                
                return recognizedPatterns;
            }

            performAnomalyDetection() {
                const anomalies = [];
                
                // 異常なファンアウト
                gates.forEach(gate => {
                    const fanout = wires.filter(w => w.outputGate === gate.id).length;
                    if (fanout > 8) {
                        anomalies.push({
                            type: 'high_fanout',
                            gate: gate.id,
                            severity: fanout > 16 ? 'critical' : 'warning',
                            value: fanout,
                            impact: 'タイミング違反とノイズの可能性'
                        });
                    }
                });
                
                // 未接続ピン
                const unconnectedInputs = this.findUnconnectedInputs();
                if (unconnectedInputs.length > 0) {
                    anomalies.push({
                        type: 'floating_inputs',
                        gates: unconnectedInputs,
                        severity: 'warning',
                        impact: '予期しない動作の可能性'
                    });
                }
                
                // 過度に長いパス
                const longPaths = this.findLongPaths();
                longPaths.forEach(path => {
                    if (path.length > 15) {
                        anomalies.push({
                            type: 'long_combinational_path',
                            path: path,
                            severity: 'critical',
                            impact: 'タイミング制約違反'
                        });
                    }
                });
                
                return anomalies;
            }

            identifyOptimizationOpportunities() {
                const opportunities = [];
                
                // ボトルネック分析
                const bottlenecks = this.identifyBottlenecks();
                bottlenecks.forEach(bottleneck => {
                    opportunities.push({
                        type: 'bottleneck_removal',
                        location: bottleneck.gate,
                        potential: bottleneck.improvement,
                        method: bottleneck.suggestedMethod
                    });
                });
                
                // 並列化機会
                const parallelizable = this.findParallelizableOperations();
                if (parallelizable.length > 0) {
                    opportunities.push({
                        type: 'parallelization',
                        operations: parallelizable,
                        potential: 'パフォーマンス向上',
                        method: 'パイプライン化または並列実行'
                    });
                }
                
                // リソース共有
                const sharable = this.findSharableResources();
                if (sharable.length > 0) {
                    opportunities.push({
                        type: 'resource_sharing',
                        resources: sharable,
                        potential: '面積削減',
                        method: 'マルチプレクサによる時分割'
                    });
                }
                
                return opportunities;
            }

            // === 高度な計算メソッド ===
            calculateCircuitLevels() {
                const levels = new Map();
                const visited = new Set();
                let maxLevels = 0;
                
                function assignLevel(gateId, level) {
                    if (visited.has(gateId)) return;
                    visited.add(gateId);
                    
                    const currentLevel = levels.get(gateId) || 0;
                    levels.set(gateId, Math.max(currentLevel, level));
                    maxLevels = Math.max(maxLevels, level);
                    
                    // 出力ゲートのレベルを設定
                    wires.forEach(wire => {
                        if (wire.outputGate === gateId) {
                            assignLevel(wire.inputGate, level + 1);
                        }
                    });
                }
                
                // 入力ゲートから開始
                gates.forEach(gate => {
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON', 'DC'].includes(gate.type)) {
                        assignLevel(gate.id, 0);
                    }
                });
                
                const distribution = {};
                levels.forEach(level => {
                    distribution[level] = (distribution[level] || 0) + 1;
                });
                
                return { maxLevels, distribution };
            }

            analyzeFanout() {
                let totalFanout = 0;
                let maxFanout = 0;
                let gateCount = 0;
                
                gates.forEach(gate => {
                    const fanout = wires.filter(w => w.outputGate === gate.id).length;
                    totalFanout += fanout;
                    maxFanout = Math.max(maxFanout, fanout);
                    if (fanout > 0) gateCount++;
                });
                
                return {
                    average: gateCount > 0 ? (totalFanout / gateCount).toFixed(2) : 0,
                    max: maxFanout
                };
            }

            analyzeConnectivity() {
                const totalPossibleConnections = gates.length * (gates.length - 1);
                const actualConnections = wires.length;
                const index = totalPossibleConnections > 0 ? 
                    (actualConnections / totalPossibleConnections).toFixed(3) : 0;
                
                const isolated = this.findIsolatedModules();
                
                return { index: parseFloat(index), isolated };
            }

            calculateAdvancedCriticalPath() {
                const delays = new Map();
                const gateDelays = {
                    'AND': 0.8, 'OR': 0.8, 'NOT': 0.3, 'NAND': 0.6, 'NOR': 0.6,
                    'XOR': 1.2, 'XNOR': 1.2, 'D_FF': 2.0, 'T_FF': 2.0, 'JK_FF': 2.2,
                    'MUX': 1.5, 'DECODER': 2.5, 'ENCODER': 2.0, 'ADDER': 3.0
                };
                
                // 遅延計算
                function calculateDelay(gateId) {
                    if (delays.has(gateId)) return delays.get(gateId);
                    
                    const gate = gates.find(g => g.id === gateId);
                    if (!gate) return 0;
                    
                    const gateDelay = gateDelays[gate.type] || 1.0;
                    const inputWires = wires.filter(w => w.inputGate === gateId);
                    
                    let maxInputDelay = 0;
                    inputWires.forEach(wire => {
                        maxInputDelay = Math.max(maxInputDelay, calculateDelay(wire.outputGate));
                    });
                    
                    const totalDelay = maxInputDelay + gateDelay;
                    delays.set(gateId, totalDelay);
                    return totalDelay;
                }
                
                // 全ゲートの遅延を計算
                gates.forEach(gate => calculateDelay(gate.id));
                
                // クリティカルパスを特定
                let maxDelay = 0;
                let criticalGate = null;
                
                gates.forEach(gate => {
                    const delay = delays.get(gate.id);
                    if (delay > maxDelay) {
                        maxDelay = delay;
                        criticalGate = gate.id;
                    }
                });
                
                const criticalPath = criticalGate ? this.traceCriticalPath(criticalGate, delays) : [];
                
                return {
                    delay: maxDelay.toFixed(2),
                    gates: criticalPath
                };
            }

            calculateStaticPower() {
                return parseFloat(this.estimatePower()) * 0.3;
            }

            calculateDynamicPower() {
                return parseFloat(this.estimatePower()) * 0.7;
            }

            calculatePowerDensity() {
                const totalArea = this.estimateArea();
                const totalPower = parseFloat(this.estimatePower());
                return totalArea > 0 ? (totalPower / totalArea).toFixed(3) : 0;
            }

            calculatePowerEfficiency() {
                const functionalGates = gates.filter(g => 
                    !['INPUT', 'OUTPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON'].includes(g.type)
                ).length;
                const totalPower = parseFloat(this.estimatePower());
                return functionalGates > 0 ? (functionalGates / totalPower).toFixed(2) : 0;
            }

            estimateBatteryLife(powerMW) {
                const batteryCapacity = 3000; // mAh
                const voltage = 3.7; // V
                const efficiency = 0.85;
                
                if (powerMW <= 0) return 'N/A';
                
                const currentMA = (powerMW / voltage) * 1000;
                const lifeHours = (batteryCapacity * efficiency) / currentMA;
                
                if (lifeHours < 24) {
                    return `${lifeHours.toFixed(1)}時間`;
                } else if (lifeHours < 720) {
                    return `${(lifeHours / 24).toFixed(1)}日`;
                } else {
                    return `${(lifeHours / 720).toFixed(1)}ヶ月`;
                }
            }

            // === 品質評価メソッド ===
            calculateQualityScore(basicMetrics, timingAnalysis, powerAnalysis) {
                let score = 100;
                
                // ゲート数ペナルティ
                if (basicMetrics.gateCount > 100) score -= 20;
                else if (basicMetrics.gateCount > 50) score -= 10;
                
                // タイミングペナルティ
                if (timingAnalysis.criticalPathDelay > 10) score -= 25;
                else if (timingAnalysis.criticalPathDelay > 5) score -= 10;
                
                // 電力ペナルティ
                if (powerAnalysis.totalPower > 10) score -= 20;
                else if (powerAnalysis.totalPower > 5) score -= 10;
                
                // 接続品質ボーナス
                const connectivity = this.analyzeConnectivity();
                if (connectivity.index > 0.1 && connectivity.index < 0.3) score += 10;
                
                return Math.max(0, score);
            }

            calculateDesignComplexityIndex() {
                const gateComplexity = gates.length;
                const wireComplexity = wires.length * 0.5;
                const typeComplexity = Object.keys(this.calculateBasicMetrics().gateTypes).length * 2;
                const pathComplexity = this.calculateCircuitLevels().maxLevels * 3;
                
                return Math.round(gateComplexity + wireComplexity + typeComplexity + pathComplexity);
            }

            calculateMaintainabilityScore() {
                let score = 100;
                
                // 複雑度による減点
                const complexity = this.calculateDesignComplexityIndex();
                if (complexity > 200) score -= 30;
                else if (complexity > 100) score -= 15;
                
                // モジュール性による加点
                const patterns = this.performPatternRecognition();
                score += patterns.length * 5;
                
                // 未接続要素による減点
                const unconnected = this.findIsolatedModules();
                score -= unconnected.length * 10;
                
                return Math.max(0, Math.min(100, score));
            }

            // === ヘルパーメソッド ===
            matchPattern(patternGates) {
                const currentGateTypes = Object.keys(this.calculateBasicMetrics().gateTypes);
                const patternSet = new Set(patternGates);
                const currentSet = new Set(currentGateTypes);
                
                const intersection = new Set([...patternSet].filter(x => currentSet.has(x)));
                const union = new Set([...patternSet, ...currentSet]);
                
                return intersection.size / union.size;
            }

            suggestPatternOptimization(patternName) {
                const optimizations = {
                    'counter': 'グレイコードカウンタで電力削減',
                    'alu': 'キャリーチェーン最適化で速度向上',
                    'memory': 'カラム多重化で面積削減',
                    'cpu_core': 'パイプライン化でスループット向上',
                    'dsp_filter': '係数の2のべき乗近似で乗算器削減'
                };
                return optimizations[patternName] || '一般的な論理簡略化';
            }

            findUnconnectedInputs() {
                const unconnected = [];
                gates.forEach(gate => {
                    if (!['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON', 'DC', 'OUTPUT'].includes(gate.type)) {
                        const hasInputConnection = wires.some(w => w.inputGate === gate.id);
                        if (!hasInputConnection) {
                            unconnected.push(gate.id);
                        }
                    }
                });
                return unconnected;
            }

            findLongPaths() {
                const paths = [];
                const visited = new Set();
                
                function tracePath(gateId, currentPath) {
                    if (visited.has(gateId) || currentPath.includes(gateId)) {
                        return [currentPath];
                    }
                    
                    const newPath = [...currentPath, gateId];
                    const outputWires = wires.filter(w => w.outputGate === gateId);
                    
                    if (outputWires.length === 0) {
                        return [newPath];
                    }
                    
                    const allPaths = [];
                    outputWires.forEach(wire => {
                        const subPaths = tracePath(wire.inputGate, newPath);
                        allPaths.push(...subPaths);
                    });
                    
                    return allPaths;
                }
                
                gates.forEach(gate => {
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON'].includes(gate.type)) {
                        const gatePaths = tracePath(gate.id, []);
                        paths.push(...gatePaths);
                    }
                });
                
                return paths.filter(path => path.length > 10);
            }

            identifyBottlenecks() {
                const bottlenecks = [];
                const fanouts = new Map();
                
                // ファンアウト計算
                gates.forEach(gate => {
                    const fanout = wires.filter(w => w.outputGate === gate.id).length;
                    fanouts.set(gate.id, fanout);
                });
                
                // 高ファンアウトゲートをボトルネックとして特定
                fanouts.forEach((fanout, gateId) => {
                    if (fanout > 6) {
                        bottlenecks.push({
                            gate: gateId,
                            type: 'high_fanout',
                            improvement: '30%',
                            suggestedMethod: 'バッファ挿入またはファンアウト分散'
                        });
                    }
                });
                
                return bottlenecks;
            }

            findSharableResources() {
                const sharable = [];
                const gateGroups = {};
                
                // 同じタイプのゲートをグループ化
                gates.forEach(gate => {
                    if (!gateGroups[gate.type]) gateGroups[gate.type] = [];
                    gateGroups[gate.type].push(gate.id);
                });
                
                // 複数の同じタイプのゲートがある場合、共有可能
                Object.entries(gateGroups).forEach(([type, gateIds]) => {
                    if (gateIds.length > 1 && ['ADDER', 'MULTIPLIER', 'DECODER'].includes(type)) {
                        sharable.push({
                            type: type,
                            count: gateIds.length,
                            gates: gateIds,
                            potential: `${gateIds.length - 1}個のゲート削減可能`
                        });
                    }
                });
                
                return sharable;
            }

            calculateMTBF() {
                const baseReliability = 100000; // 基本MTBF (時間)
                const gateReliabilityFactors = {
                    'AND': 1.0, 'OR': 1.0, 'NOT': 1.1, 'NAND': 0.95, 'NOR': 0.95,
                    'XOR': 0.9, 'XNOR': 0.9, 'D_FF': 0.8, 'T_FF': 0.8, 'JK_FF': 0.75,
                    'MUX': 0.85, 'DECODER': 0.8, 'ENCODER': 0.85, 'ADDER': 0.7
                };
                
                let totalReliability = 1.0;
                gates.forEach(gate => {
                    const factor = gateReliabilityFactors[gate.type] || 0.9;
                    totalReliability *= factor;
                });
                
                return Math.round(baseReliability * totalReliability);
            }

            identifySinglePointFailures() {
                const spofs = [];
                
                gates.forEach(gate => {
                    if (gate.type === 'OUTPUT') return;
                    
                    // このゲートが故障した場合の影響を評価
                    const outputWires = wires.filter(w => w.outputGate === gate.id);
                    const affectedOutputs = this.traceToOutputs(gate.id);
                    
                    if (affectedOutputs.length > 0 && outputWires.length === 1) {
                        spofs.push({
                            gate: gate.id,
                            type: gate.type,
                            affectedOutputs: affectedOutputs,
                            risk: 'high'
                        });
                    }
                });
                
                return spofs;
            }

            analyzeRedundancy() {
                // 冗長性の分析
                const parallelPaths = this.findParallelPaths();
                const redundantGates = this.findRedundantGates();
                
                return {
                    level: parallelPaths.length > 0 ? 'medium' : 'low',
                    faultTolerant: redundantGates.length > 2,
                    parallelPaths: parallelPaths.length,
                    redundantElements: redundantGates.length
                };
            }

            calculateErrorDetectionCoverage() {
                // エラー検出カバレッジの計算
                const totalPaths = this.getAllSignalPaths().length;
                const monitoredPaths = gates.filter(g => g.type === 'OUTPUT').length;
                
                return totalPaths > 0 ? ((monitoredPaths / totalPaths) * 100).toFixed(1) : 0;
            }

            generateThermalMap() {
                const powerMap = new Map();
                const powerValues = {
                    'AND': 0.1, 'OR': 0.1, 'NOT': 0.05, 'NAND': 0.08, 'NOR': 0.08,
                    'XOR': 0.15, 'XNOR': 0.15, 'D_FF': 0.5, 'T_FF': 0.5, 'JK_FF': 0.6,
                    'MUX': 0.2, 'DECODER': 0.3, 'ENCODER': 0.25, 'ADDER': 0.4
                };
                
                let maxTemp = 25; // 基本温度
                let totalTemp = 0;
                let gateCount = 0;
                
                gates.forEach(gate => {
                    const power = powerValues[gate.type] || 0.1;
                    const temp = 25 + (power * 10); // 簡易熱計算
                    powerMap.set(gate.id, temp);
                    maxTemp = Math.max(maxTemp, temp);
                    totalTemp += temp;
                    gateCount++;
                });
                
                return {
                    max: maxTemp.toFixed(1),
                    average: gateCount > 0 ? (totalTemp / gateCount).toFixed(1) : 25,
                    gradient: (maxTemp - 25).toFixed(1)
                };
            }

            identifyThermalHotspots() {
                const thermalMap = this.generateThermalMap();
                const threshold = parseFloat(thermalMap.average) + 5;
                const hotspots = [];
                
                gates.forEach(gate => {
                    const powerValues = {
                        'D_FF': 0.5, 'T_FF': 0.5, 'JK_FF': 0.6, 'ADDER': 0.4, 'DECODER': 0.3
                    };
                    
                    if (powerValues[gate.type] && powerValues[gate.type] > 0.3) {
                        hotspots.push({
                            gate: gate.id,
                            type: gate.type,
                            temperature: (25 + powerValues[gate.type] * 10).toFixed(1),
                            risk: powerValues[gate.type] > 0.5 ? 'high' : 'medium'
                        });
                    }
                });
                
                return hotspots;
            }

            calculateCoolingRequirement(maxTemp) {
                const tempFloat = parseFloat(maxTemp);
                if (tempFloat < 40) return 'なし';
                if (tempFloat < 60) return '自然対流';
                if (tempFloat < 80) return '強制対流';
                return 'アクティブ冷却';
            }

            // === ユーティリティメソッド ===
            traceToOutputs(gateId) {
                const outputs = [];
                const visited = new Set();
                
                function trace(id) {
                    if (visited.has(id)) return;
                    visited.add(id);
                    
                    const gate = gates.find(g => g.id === id);
                    if (gate && gate.type === 'OUTPUT') {
                        outputs.push(id);
                        return;
                    }
                    
                    wires.forEach(wire => {
                        if (wire.outputGate === id) {
                            trace(wire.inputGate);
                        }
                    });
                }
                
                trace(gateId);
                return outputs;
            }

            findParallelPaths() {
                // 並列パスの検出
                const parallelPaths = [];
                const pathMap = new Map();
                
                gates.forEach(inputGate => {
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON'].includes(inputGate.type)) {
                        gates.forEach(outputGate => {
                            if (outputGate.type === 'OUTPUT') {
                                const paths = this.findAllPaths(inputGate.id, outputGate.id);
                                if (paths.length > 1) {
                                    parallelPaths.push({
                                        input: inputGate.id,
                                        output: outputGate.id,
                                        pathCount: paths.length
                                    });
                                }
                            }
                        });
                    }
                });
                
                return parallelPaths;
            }

            findRedundantGates() {
                // 冗長ゲートの検出
                const redundant = [];
                const gateTypes = {};
                
                gates.forEach(gate => {
                    if (!gateTypes[gate.type]) gateTypes[gate.type] = [];
                    gateTypes[gate.type].push(gate.id);
                });
                
                Object.entries(gateTypes).forEach(([type, gateIds]) => {
                    if (gateIds.length > 3 && ['AND', 'OR', 'NOT'].includes(type)) {
                        redundant.push(...gateIds.slice(3));
                    }
                });
                
                return redundant;
            }

            getAllSignalPaths() {
                const paths = [];
                
                gates.forEach(inputGate => {
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON'].includes(inputGate.type)) {
                        gates.forEach(outputGate => {
                            if (outputGate.type === 'OUTPUT') {
                                const gatePaths = this.findAllPaths(inputGate.id, outputGate.id);
                                paths.push(...gatePaths);
                            }
                        });
                    }
                });
                
                return paths;
            }

            findAllPaths(startId, endId) {
                const paths = [];
                const visited = new Set();
                
                function dfs(currentId, path) {
                    if (currentId === endId) {
                        paths.push([...path, currentId]);
                        return;
                    }
                    
                    if (visited.has(currentId)) return;
                    visited.add(currentId);
                    
                    wires.forEach(wire => {
                        if (wire.outputGate === currentId) {
                            dfs(wire.inputGate, [...path, currentId]);
                        }
                    });
                    
                    visited.delete(currentId);
                }
                
                dfs(startId, []);
                return paths;
            }

            findStronglyConnectedComponents() {
                // Tarjanのアルゴリズムによる強連結成分の検出
                const components = [];
                const indices = new Map();
                const lowlinks = new Map();
                const onStack = new Set();
                const stack = [];
                let index = 0;
                
                function strongConnect(gateId) {
                    indices.set(gateId, index);
                    lowlinks.set(gateId, index);
                    index++;
                    stack.push(gateId);
                    onStack.add(gateId);
                    
                    wires.forEach(wire => {
                        if (wire.outputGate === gateId) {
                            const w = wire.inputGate;
                            if (!indices.has(w)) {
                                strongConnect(w);
                                lowlinks.set(gateId, Math.min(lowlinks.get(gateId), lowlinks.get(w)));
                            } else if (onStack.has(w)) {
                                lowlinks.set(gateId, Math.min(lowlinks.get(gateId), indices.get(w)));
                            }
                        }
                    });
                    
                    if (lowlinks.get(gateId) === indices.get(gateId)) {
                        const component = [];
                        let w;
                        do {
                            w = stack.pop();
                            onStack.delete(w);
                            component.push(w);
                        } while (w !== gateId);
                        
                        if (component.length > 1) {
                            components.push(component);
                        }
                    }
                }
                
                gates.forEach(gate => {
                    if (!indices.has(gate.id)) {
                        strongConnect(gate.id);
                    }
                });
                
                return components;
            }

            calculateSetupTimes() {
                // セットアップタイム解析
                const flipflops = gates.filter(g => ['D_FF', 'T_FF', 'JK_FF'].includes(g.type));
                let minMargin = Infinity;
                
                flipflops.forEach(ff => {
                    const setupTime = 0.5; // ns
                    const inputWires = wires.filter(w => w.inputGate === ff.id);
                    
                    inputWires.forEach(wire => {
                        const sourceGate = gates.find(g => g.id === wire.outputGate);
                        if (sourceGate) {
                            const propagationDelay = this.getGateDelay(sourceGate.type);
                            const margin = setupTime - propagationDelay;
                            minMargin = Math.min(minMargin, margin);
                        }
                    });
                });
                
                return {
                    margin: minMargin === Infinity ? 0 : minMargin.toFixed(2)
                };
            }

            estimateClockSkew() {
                // クロックスキュー見積もり
                const flipflops = gates.filter(g => ['D_FF', 'T_FF', 'JK_FF'].includes(g.type));
                const skewPerLevel = 0.1; // ns per logic level
                const maxLevels = this.calculateCircuitLevels().maxLevels;
                
                return (maxLevels * skewPerLevel).toFixed(2);
            }

            identifyTimingViolations() {
                const violations = [];
                const flipflops = gates.filter(g => ['D_FF', 'T_FF', 'JK_FF'].includes(g.type));
                
                flipflops.forEach(ff => {
                    const inputWires = wires.filter(w => w.inputGate === ff.id);
                    inputWires.forEach(wire => {
                        const sourceGate = gates.find(g => g.id === wire.outputGate);
                        if (sourceGate) {
                            const delay = this.getGateDelay(sourceGate.type);
                            if (delay > 2.0) { // タイミング制約
                                violations.push({
                                    type: 'setup_violation',
                                    flipflop: ff.id,
                                    source: sourceGate.id,
                                    delay: delay,
                                    severity: delay > 3.0 ? 'critical' : 'warning'
                                });
                            }
                        }
                    });
                });
                
                return violations;
            }

            performSlackAnalysis() {
                // スラック解析
                const slacks = new Map();
                const targetFreq = 100; // MHz
                const clockPeriod = 1000 / targetFreq; // ns
                
                gates.forEach(gate => {
                    const criticalPath = this.calculateAdvancedCriticalPath();
                    const slack = clockPeriod - parseFloat(criticalPath.delay);
                    slacks.set(gate.id, slack);
                });
                
                const positiveSlacks = Array.from(slacks.values()).filter(s => s > 0);
                const negativeSlacks = Array.from(slacks.values()).filter(s => s <= 0);
                
                return {
                    worstSlack: Math.min(...slacks.values()).toFixed(2),
                    totalNegativeSlack: negativeSlacks.reduce((sum, s) => sum + Math.abs(s), 0).toFixed(2),
                    violatingPaths: negativeSlacks.length
                };
            }

            identifyPowerHotspots() {
                const hotspots = [];
                const powerThreshold = 0.3; // mW
                
                gates.forEach(gate => {
                    const gatePower = this.getGatePower(gate.type);
                    if (gatePower > powerThreshold) {
                        hotspots.push({
                            gate: gate.id,
                            type: gate.type,
                            power: gatePower,
                            relative: (gatePower / parseFloat(this.estimatePower()) * 100).toFixed(1) + '%'
                        });
                    }
                });
                
                return hotspots.sort((a, b) => b.power - a.power);
            }

            getGateDelay(gateType) {
                const delays = {
                    'AND': 0.8, 'OR': 0.8, 'NOT': 0.3, 'NAND': 0.6, 'NOR': 0.6,
                    'XOR': 1.2, 'XNOR': 1.2, 'D_FF': 2.0, 'T_FF': 2.0, 'JK_FF': 2.2,
                    'MUX': 1.5, 'DECODER': 2.5, 'ENCODER': 2.0, 'ADDER': 3.0
                };
                return delays[gateType] || 1.0;
            }

            getGatePower(gateType) {
                const powers = {
                    'AND': 0.1, 'OR': 0.1, 'NOT': 0.05, 'NAND': 0.08, 'NOR': 0.08,
                    'XOR': 0.15, 'XNOR': 0.15, 'D_FF': 0.5, 'T_FF': 0.5, 'JK_FF': 0.6,
                    'MUX': 0.2, 'DECODER': 0.3, 'ENCODER': 0.25, 'ADDER': 0.4
                };
                return powers[gateType] || 0.1;
            }

            performThermalAnalysis() {
                const hotspots = this.identifyThermalHotspots();
                const maxTemp = this.estimateMaxTemperature();
                
                return {
                    estimatedMaxTemp: maxTemp,
                    thermalHotspots: hotspots,
                    thermalResistance: this.calculateThermalResistance(),
                    coolingRequired: maxTemp > 85,
                    thermalMargin: Math.max(0, 85 - maxTemp)
                };
            }

            performPatternRecognition() {
                const recognizedPatterns = [];
                
                for (const [patternName, pattern] of this.designPatterns) {
                    const matchScore = this.calculatePatternMatch(pattern);
                    if (matchScore > 0.7) {
                        recognizedPatterns.push({
                            name: patternName,
                            description: pattern.description,
                            matchScore: matchScore,
                            confidence: matchScore * 0.9
                        });
                    }
                }
                
                return {
                    recognizedPatterns: recognizedPatterns,
                    patternComplexity: this.assessPatternComplexity(recognizedPatterns),
                    designStyle: this.identifyDesignStyle(),
                    architecturalPatterns: this.identifyArchitecturalPatterns()
                };
            }

            performAnomalyDetection() {
                const anomalies = [];
                
                // 構造的異常
                const structuralAnomalies = this.detectStructuralAnomalies();
                const timingAnomalies = this.detectTimingAnomalies();
                const powerAnomalies = this.detectPowerAnomalies();
                
                return {
                    structural: structuralAnomalies,
                    timing: timingAnomalies,
                    power: powerAnomalies,
                    severity: this.assessAnomalySeverity([...structuralAnomalies, ...timingAnomalies, ...powerAnomalies])
                };
            }

            identifyOptimizationOpportunities() {
                const opportunities = [];
                
                // 面積最適化
                const areaOptimizations = this.identifyAreaOptimizations();
                
                // 電力最適化
                const powerOptimizations = this.identifyPowerOptimizations();
                
                // 速度最適化
                const speedOptimizations = this.identifySpeedOptimizations();
                
                // 信頼性最適化
                const reliabilityOptimizations = this.identifyReliabilityOptimizations();
                
                return {
                    area: areaOptimizations,
                    power: powerOptimizations,
                    speed: speedOptimizations,
                    reliability: reliabilityOptimizations,
                    priority: this.prioritizeOptimizations([...areaOptimizations, ...powerOptimizations, ...speedOptimizations])
                };
            }

            // 高度な解析メソッド群
            calculateCircuitLevels() {
                const levels = new Map();
                const visited = new Set();
                let maxLevels = 0;
                
                function dfs(gateId, level) {
                    if (visited.has(gateId)) return levels.get(gateId) || 0;
                    
                    visited.add(gateId);
                    levels.set(gateId, level);
                    maxLevels = Math.max(maxLevels, level);
                    
                    const connectedWires = wires.filter(w => w.outputGate === gateId);
                    connectedWires.forEach(wire => {
                        dfs(wire.inputGate, level + 1);
                    });
                    
                    return level;
                }
                
                gates.forEach(gate => {
                    if (['INPUT', 'PUSH_BUTTON', 'TOGGLE_BUTTON', 'DC'].includes(gate.type)) {
                        dfs(gate.id, 0);
                    }
                });
                
                const distribution = Array(maxLevels + 1).fill(0);
                for (const level of levels.values()) {
                    distribution[level]++;
                }
                
                return { maxLevels, distribution };
            }

            analyzeFanout() {
                const fanouts = gates.map(gate => {
                    return wires.filter(w => w.outputGate === gate.id).length;
                });
                
                return {
                    average: fanouts.reduce((a, b) => a + b, 0) / fanouts.length || 0,
                    max: Math.max(...fanouts),
                    distribution: fanouts
                };
            }

            analyzeConnectivity() {
                const adjacencyList = new Map();
                gates.forEach(gate => adjacencyList.set(gate.id, []));
                
                wires.forEach(wire => {
                    if (adjacencyList.has(wire.outputGate)) {
                        adjacencyList.get(wire.outputGate).push(wire.inputGate);
                    }
                });
                
                const isolated = gates.filter(gate => {
                    const outgoing = adjacencyList.get(gate.id).length;
                    const incoming = wires.filter(w => w.inputGate === gate.id).length;
                    return outgoing === 0 && incoming === 0;
                });
                
                const totalConnections = wires.length;
                const maxPossibleConnections = gates.length * (gates.length - 1);
                const connectivityIndex = maxPossibleConnections > 0 ? totalConnections / maxPossibleConnections : 0;
                
                return {
                    index: connectivityIndex,
                    isolated: isolated.length
                };
            }

            calculateAdvancedCriticalPath() {
                const delays = new Map();
                const gateDelays = {
                    'AND': 1.2, 'OR': 1.1, 'NOT': 0.8, 'NAND': 1.0, 'NOR': 1.0,
                    'XOR': 1.8, 'XNOR': 1.8, 'D_FF': 2.5, 'T_FF': 2.5, 'JK_FF': 3.0,
                    'MUX': 2.0, 'DECODER': 2.8, 'ENCODER': 2.5, 'ADDER': 3.5, 'ALU_181': 8.5
                };
                
                function calculateDelay(gateId, visited = new Set()) {
                    if (visited.has(gateId)) return 0; // サイクル検出
                    if (delays.has(gateId)) return delays.get(gateId);
                    
                    visited.add(gateId);
                    const gate = gates.find(g => g.id === gateId);
                    if (!gate) return 0;
                    
                    const gateDelay = gateDelays[gate.type] || 1.0;
                    const inputWires = wires.filter(w => w.inputGate === gateId);
                    
                    let maxInputDelay = 0;
                    inputWires.forEach(wire => {
                        const inputDelay = calculateDelay(wire.outputGate, new Set(visited));
                        maxInputDelay = Math.max(maxInputDelay, inputDelay);
                    });
                    
                    const totalDelay = maxInputDelay + gateDelay;
                    delays.set(gateId, totalDelay);
                    visited.delete(gateId);
                    
                    return totalDelay;
                }
                
                let maxDelay = 0;
                let criticalGates = [];
                
                gates.forEach(gate => {
                    if (gate.type === 'OUTPUT') {
                        const delay = calculateDelay(gate.id);
                        if (delay > maxDelay) {
                            maxDelay = delay;
                            criticalGates = this.traceCriticalPath(gate.id, delays);
                        }
                    }
                });
                
                return {
                    delay: maxDelay,
                    gates: criticalGates
                };
            }

            calculatePowerDensity() {
                const totalPower = this.estimatePower();
                const totalArea = this.estimateArea();
                return totalArea > 0 ? totalPower / totalArea : 0;
            }

            calculateMTBF() {
                const gateReliabilities = {
                    'AND': 0.9999, 'OR': 0.9999, 'NOT': 0.9999, 'NAND': 0.9998, 'NOR': 0.9998,
                    'XOR': 0.9997, 'XNOR': 0.9997, 'D_FF': 0.999, 'T_FF': 0.999, 'JK_FF': 0.9985,
                    'MUX': 0.9995, 'DECODER': 0.9993, 'ALU_181': 0.998
                };
                
                let systemReliability = 1.0;
                gates.forEach(gate => {
                    const reliability = gateReliabilities[gate.type] || 0.9995;
                    systemReliability *= reliability;
                });
                
                // MTBF in hours (assuming 1 year = 8760 hours)
                const failureRate = -Math.log(systemReliability);
                return failureRate > 0 ? 8760 / failureRate : 100000;
            }

            identifyAreaOptimizations() {
                const optimizations = [];
                
                // ゲート共有の機会
                const shareableGates = this.findShareableGates();
                if (shareableGates.length > 0) {
                    optimizations.push({
                        type: 'gate_sharing',
                        description: `${shareableGates.length}個のゲートで共有可能`,
                        impact: 'medium',
                        savings: shareableGates.length * 0.3
                    });
                }
                
                // 論理最小化
                const minimizableLogic = this.findMinimizableLogic();
                if (minimizableLogic.length > 0) {
                    optimizations.push({
                        type: 'logic_minimization',
                        description: '論理式の簡略化でゲート数削減可能',
                        impact: 'high',
                        savings: minimizableLogic.length * 0.5
                    });
                }
                
                return optimizations;
            }

            identifyPowerOptimizations() {
                const optimizations = [];
                const gateTypes = this.analyzeGateTypes();
                
                // クロックゲーティング
                if (gateTypes['D_FF'] > 5) {
                    optimizations.push({
                        type: 'clock_gating',
                        description: 'フリップフロップのクロックゲーティング',
                        impact: 'high',
                        savings: gateTypes['D_FF'] * 0.4
                    });
                }
                
                // 電力ゲーティング
                const isolatedModules = this.findIsolatedModules();
                if (isolatedModules.length > 0) {
                    optimizations.push({
                        type: 'power_gating',
                        description: '未使用モジュールの電力ゲーティング',
                        impact: 'very_high',
                        savings: isolatedModules.length * 0.8
                    });
                }
                
                return optimizations;
            }

            identifySpeedOptimizations() {
                const optimizations = [];
                const criticalPath = this.calculateAdvancedCriticalPath();
                
                // パイプライン挿入
                if (criticalPath.delay > 8.0) {
                    optimizations.push({
                        type: 'pipeline_insertion',
                        description: 'クリティカルパスにパイプライン段を挿入',
                        impact: 'very_high',
                        improvement: criticalPath.delay * 0.6
                    });
                }
                
                // 並列化
                const parallelizableOperations = this.findParallelizableOperations();
                if (parallelizableOperations.length > 0) {
                    optimizations.push({
                        type: 'parallelization',
                        description: '演算の並列化で処理速度向上',
                        impact: 'high',
                        improvement: parallelizableOperations.length * 1.5
                    });
                }
                
                return optimizations;
            }

            // ヘルパーメソッド
            findShareableGates() {
                // 同じ入力を持つゲートを検索
                const gateGroups = new Map();
                gates.forEach(gate => {
                    const inputs = wires.filter(w => w.inputGate === gate.id)
                                       .map(w => w.outputGate)
                                       .sort()
                                       .join(',');
                    if (!gateGroups.has(inputs)) {
                        gateGroups.set(inputs, []);
                    }
                    gateGroups.get(inputs).push(gate);
                });
                
                return Array.from(gateGroups.values()).filter(group => group.length > 1).flat();
            }

            findMinimizableLogic() {
                // 本格的な論理最小化機会を検索（NOT-NOT, De Morgan, AND/OR吸収則など）
                const minimizable = [];
                // 1. NOT-NOT（二重否定）
                gates.forEach(gate => {
                    if (gate.type === 'NOT') {
                        const connectedGates = wires.filter(w => w.outputGate === gate.id)
                                                   .map(w => gates.find(g => g.id === w.inputGate))
                                                   .filter(g => g && g.type === 'NOT');
                        if (connectedGates.length > 0) {
                            minimizable.push({ type: 'double-negation', gate, targets: connectedGates });
                        }
                    }
                });
                // 2. De Morgan（NAND/NOR→AND/OR+NOT）
                gates.forEach(gate => {
                    if (gate.type === 'NAND' || gate.type === 'NOR') {
                        // 出力がNOTにつながっている場合
                        const outWires = wires.filter(w => w.outputGate === gate.id);
                        outWires.forEach(w => {
                            const nextGate = gates.find(g => g.id === w.inputGate);
                            if (nextGate && nextGate.type === 'NOT') {
                                minimizable.push({ type: 'de-morgan', gate, targets: [nextGate] });
                            }
                        });
                    }
                });
                // 3. AND/OR吸収則（A + AB = A など）
                // 簡易例: 同じ入力を持つAND/ORゲートが複数ある場合
                const inputMap = new Map();
                gates.forEach(gate => {
                    if (gate.type === 'AND' || gate.type === 'OR') {
                        const key = wires.filter(w => w.inputGate === gate.id)
                                         .map(w => w.outputGate)
                                         .sort().join(',');
                        if (!inputMap.has(key)) inputMap.set(key, []);
                        inputMap.get(key).push(gate);
                    }
                });
                inputMap.forEach((group, key) => {
                    if (group.length > 1) {
                        minimizable.push({ type: 'absorption', gates: group });
                    }
                });
                return minimizable;
            }

            calculateQualityScore(basicMetrics, timingAnalysis, powerAnalysis) {
                let score = 100;
                
                // 複雑度ペナルティ
                if (basicMetrics.gateCount > 50) score -= 10;
                if (basicMetrics.gateCount > 100) score -= 20;
                
                // タイミングペナルティ
                if (timingAnalysis.criticalPathDelay > 10) score -= 15;
                if (timingAnalysis.criticalPathDelay > 20) score -= 30;
                
                // 電力ペナルティ
                if (powerAnalysis.totalPower > 10) score -= 10;
                if (powerAnalysis.totalPower > 20) score -= 25;
                
                return Math.max(0, score);
            }

            calculateComplexity() {
                return Math.round(gates.length + wires.length * 0.5);
            }

            analyzeGateTypes() {
                const types = {};
                gates.forEach(gate => {
                    types[gate.type] = (types[gate.type] || 0) + 1;
                });
                return types;
            }

            calculateCriticalPath() {
                // 簡易的なクリティカルパス計算
                let maxDepth = 0;
                const visited = new Set();
                
                function dfs(gateId, depth) {
                    if (visited.has(gateId)) return depth;
                    visited.add(gateId);
                    
                    const gate = gates.find(g => g.id === gateId);
                    if (!gate) return depth;
                    
                    let maxChildDepth = depth;
                    wires.forEach(wire => {
                        if (wire.outputGate === gateId) {
                            maxChildDepth = Math.max(maxChildDepth, dfs(wire.inputGate, depth + 1));
                        }
                    });
                    
                    return maxChildDepth;
                }
                
                gates.forEach(gate => {
                    if (gate.type === 'INPUT' || gate.type === 'PUSH_BUTTON' || gate.type === 'TOGGLE_BUTTON') {
                        maxDepth = Math.max(maxDepth, dfs(gate.id, 0));
                    }
                });
                
                return maxDepth;
            }

            estimatePower() {
                // 簡易的な消費電力見積もり (mW)
                const powerMap = {
                    'AND': 0.1, 'OR': 0.1, 'NOT': 0.05, 'NAND': 0.08, 'NOR': 0.08,
                    'XOR': 0.15, 'XNOR': 0.15, 'D_FF': 0.5, 'T_FF': 0.5, 'JK_FF': 0.6,
                    'MUX': 0.2, 'DECODER': 0.3, 'ENCODER': 0.25, 'ADDER': 0.4
                };
                
                return gates.reduce((total, gate) => {
                    return total + (powerMap[gate.type] || 0.1);
                }, 0).toFixed(2);
            }

            estimateArea() {
                // 簡易的な面積見積もり (相対単位)
                const areaMap = {
                    'AND': 1, 'OR': 1, 'NOT': 0.5, 'NAND': 0.8, 'NOR': 0.8,
                    'XOR': 2, 'XNOR': 2, 'D_FF': 4, 'T_FF': 4, 'JK_FF': 5,
                    'MUX': 3, 'DECODER': 4, 'ENCODER': 3, 'ADDER': 6
                };
                
                return gates.reduce((total, gate) => {
                    return total + (areaMap[gate.type] || 1);
                }, 0);
            }

            generateSuggestions() {
                const suggestions = [];
                
                if (gates.length > 50) {
                    suggestions.push("⚠️ 回路が複雑すぎます。階層化やサブ回路への分割を検討してください。");
                }
                
                if (wires.length > gates.length * 2) {
                    suggestions.push("🔌 配線が多すぎます。論理の簡略化を検討してください。");
                }
                
                const criticalPath = this.calculateCriticalPath();
                if (criticalPath > 10) {
                    suggestions.push("⏱️ クリティカルパスが長すぎます。パイプライン化を検討してください。");
                }
                
                const gateTypes = this.analyzeGateTypes();
                if (gateTypes['NOT'] > gates.length * 0.3) {
                    suggestions.push("🔄 NOTゲートが多すぎます。ド・モルガンの法則で簡略化できます。");
                }
                
                if (gates.length === 0) {
                    suggestions.push("📝 回路が空です。ゲートを配置して回路を設計してください。");
                }
                
                return suggestions;
            }

            detectOptimizationOpportunities() {
                const opportunities = [];
                
                // 二重否定の検出
                const notGates = gates.filter(g => g.type === 'NOT');
                notGates.forEach(gate => {
                    const connectedWires = wires.filter(w => w.outputGate === gate.id);
                    connectedWires.forEach(wire => {
                        const targetGate = gates.find(g => g.id === wire.inputGate);
                        if (targetGate && targetGate.type === 'NOT') {
                            opportunities.push({
                                type: 'redundant_not',
                                description: '二重否定の除去が可能です',
                                gates: [gate.id, targetGate.id],
                                impact: '論理ゲート数を2個削減'
                            });
                        }
                    });
                });
                
                // ド・モルガンの法則適用可能性
                const nandGates = gates.filter(g => g.type === 'NAND');
                const norGates = gates.filter(g => g.type === 'NOR');
                
                if (nandGates.length > 0 || norGates.length > 0) {
                    opportunities.push({
                        type: 'demorgan',
                        description: 'ド・モルガンの法則で論理を簡略化できます',
                        gates: [...nandGates, ...norGates].map(g => g.id),
                        impact: 'ゲート数削減の可能性'
                    });
                }
                
                // 未使用ゲートの検出
                const unusedGates = gates.filter(gate => {
                    if (gate.type === 'OUTPUT') return false;
                    return !wires.some(w => w.outputGate === gate.id);
                });
                
                if (unusedGates.length > 0) {
                    opportunities.push({
                        type: 'unused_gates',
                        description: `${unusedGates.length}個の未使用ゲートを削除できます`,
                        gates: unusedGates.map(g => g.id),
                        impact: `${unusedGates.length}個のゲートを削減`
                    });
                }
                
                // 高ファンアウトの検出
                gates.forEach(gate => {
                    const fanout = wires.filter(w => w.outputGate === gate.id).length;
                    if (fanout > 5) {
                        opportunities.push({
                            type: 'high_fanout',
                            description: `ゲート${gate.id}のファンアウトが高すぎます (${fanout})`,
                            gates: [gate.id],
                            impact: 'バッファ挿入を推奨'
                        });
                    }
                });
                
                return opportunities;
            }

            generateCircuitPattern(patternName) {
                const pattern = this.designPatterns.get(patternName);
                if (!pattern) return null;
                
                return {
                    name: pattern.name,
                    description: pattern.description,
                    gates: pattern.gates,
                    layout: this.generateLayout(pattern.gates),
                    wires: pattern.wires || []
                };
            }

            generateLayout(gateTypes) {
                const layout = [];
                let x = 100, y = 100;
                
                gateTypes.forEach((type, index) => {
                    layout.push({
                        type: type,
                        x: x + (index % 4) * 100,
                        y: y + Math.floor(index / 4) * 80
                    });
                });
                
                return layout;
            }
        }

        // Pro13 AI Manager インスタンス
        const pro13AI = new Pro13AIManager();

        // AI機能の実装
        function executeAICircuitAnalysis() {
            try {
                if (gates.length === 0) {
                    alert('回路が空です。ゲートを配置してから分析してください。');
                    return;
                }
                
                // 完全な回路分析を実行
                const analysis = {
                    gateCount: gates.length,
                    wireCount: wires.length,
                    complexity: Math.ceil(gates.length / 10) + Math.ceil(wires.length / 15),
                    criticalPath: calculateCriticalPath(),
                    powerEstimate: estimatePowerConsumption(),
                    areaEstimate: estimateArea(),
                    gateTypes: getGateTypeDistribution(),
                    suggestions: generateOptimizationSuggestions()
                };
                
                let resultHtml = `
                    <div style="background: linear-gradient(135deg, #9c27b0 0%, #e91e63 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">🔍 回路分析結果</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">詳細回路解析レポート</p>
                    </div>
                    
                    <div style="display: grid; gap: 10px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 5px solid #007bff;">
                            <strong>📊 基本統計</strong><br>
                            ゲート数: <span style="color: #007bff; font-weight: bold;">${analysis.gateCount}</span>個<br>
                            配線数: <span style="color: #007bff; font-weight: bold;">${analysis.wireCount}</span>本<br>
                            回路複雑度: <span style="color: #007bff; font-weight: bold;">${analysis.complexity}</span><br>
                            クリティカルパス: <span style="color: #007bff; font-weight: bold;">${analysis.criticalPath}</span>段
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 5px solid #ffc107;">
                            <strong>⚡ 性能予測</strong><br>
                            推定消費電力: <span style="color: #e65100; font-weight: bold;">${analysis.powerEstimate.toFixed(2)}</span> mW<br>
                            推定回路面積: <span style="color: #e65100; font-weight: bold;">${analysis.areaEstimate}</span> 単位²<br>
                            最大伝播遅延: <span style="color: #e65100; font-weight: bold;">${(analysis.criticalPath * 0.5).toFixed(1)}</span> ns<br>
                            最大動作周波数: <span style="color: #e65100; font-weight: bold;">${(1000 / (analysis.criticalPath * 0.5 + 1)).toFixed(0)}</span> MHz
                        </div>
                        
                        <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 5px solid #28a745;">
                            <strong>🎯 ゲート構成</strong><br>
                            ${Object.entries(analysis.gateTypes).map(([type, count]) => 
                                `<span style="color: #155724;">${type}</span>: <strong>${count}</strong>個`
                            ).join('<br>')}
                        </div>
                        
                        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 5px solid #dc3545;">
                            <strong>💡 改善提案</strong><br>
                            ${analysis.suggestions.length > 0 ? 
                                analysis.suggestions.map(s => `• ${s}`).join('<br>') : 
                                '<span style="color: #155724;">✅ 現在の設計は良好です。特に改善点は見つかりませんでした。</span>'
                            }
                        </div>
                    </div>
                `;
                
                showConfigDialog('AI回路分析結果', resultHtml, function() { return true; });
                status.textContent = `AI分析完了: ${analysis.gateCount}ゲート、複雑度${analysis.complexity}`;
                
            } catch (error) {
                console.error('AI分析エラー:', error);
                alert('AI分析中にエラーが発生しました: ' + error.message);
            }
        }

        // 補助関数群
        function calculateCriticalPath() {
            try {
                if (gates.length === 0) return 0;
                
                // 各ゲートの段数を計算
                const levels = new Map();
                const inputs = gates.filter(g => g.type === 'INPUT');
                
                // 入力ゲートはレベル0
                inputs.forEach(gate => levels.set(gate.id, 0));
                
                let changed = true;
                let iterations = 0;
                const maxIterations = 100;
                
                while (changed && iterations < maxIterations) {
                    changed = false;
                    iterations++;
                    
                    gates.forEach(gate => {
                        if (gate.type === 'INPUT') return;
                        
                        const inputWires = wires.filter(w => w.endGateId === gate.id);
                        if (inputWires.length === 0) return;
                        
                        const inputLevels = inputWires.map(wire => {
                            const sourceGate = gates.find(g => g.id === wire.startGateId);
                            return levels.get(sourceGate?.id) || 0;
                        });
                        
                        if (inputLevels.every(level => level !== undefined)) {
                            const newLevel = Math.max(...inputLevels) + 1;
                            const currentLevel = levels.get(gate.id);
                            
                            if (currentLevel === undefined || newLevel > currentLevel) {
                                levels.set(gate.id, newLevel);
                                changed = true;
                            }
                        }
                    });
                }
                
                return Math.max(...Array.from(levels.values()), 0);
                
            } catch (error) {
                console.error('クリティカルパス計算エラー:', error);
                return 1;
            }
        }

        function estimatePowerConsumption() {
            try {
                const gateTypePower = {
                    'INPUT': 0.1,
                    'OUTPUT': 0.1,
                    'AND': 1.2,
                    'OR': 1.1,
                    'NOT': 0.8,
                    'NAND': 1.0,
                    'NOR': 0.9,
                    'XOR': 1.5,
                    'D_FF': 3.0,
                    'FULL_ADDER': 2.5,
                    'MUX': 1.8,
                    'DECODER': 2.0
                };
                
                return gates.reduce((total, gate) => {
                    return total + (gateTypePower[gate.type] || 1.0);
                }, 0);
                
            } catch (error) {
                console.error('消費電力推定エラー:', error);
                return 1.0;
            }
        }

        function estimateArea() {
            try {
                const gateTypeArea = {
                    'INPUT': 1,
                    'OUTPUT': 1,
                    'AND': 4,
                    'OR': 4,
                    'NOT': 2,
                    'NAND': 3,
                    'NOR': 3,
                    'XOR': 6,
                    'D_FF': 12,
                    'FULL_ADDER': 10,
                    'MUX': 8,
                    'DECODER': 15
                };
                
                return gates.reduce((total, gate) => {
                    return total + (gateTypeArea[gate.type] || 4);
                }, 0);
                
            } catch (error) {
                console.error('面積推定エラー:', error);
                return gates.length * 4;
            }
        }

        function getGateTypeDistribution() {
            try {
                const distribution = {};
                gates.forEach(gate => {
                    distribution[gate.type] = (distribution[gate.type] || 0) + 1;
                });
                return distribution;
                
            } catch (error) {
                console.error('ゲート分布計算エラー:', error);
                return { 'UNKNOWN': gates.length };
            }
        }

        function generateOptimizationSuggestions() {
            try {
                const suggestions = [];
                const gateTypes = getGateTypeDistribution();
                const inputs = gates.filter(g => g.type === 'INPUT');
                const outputs = gates.filter(g => g.type === 'OUTPUT');
                
                // 基本的な提案生成
                if (gates.length > 50) {
                    suggestions.push('大規模回路です。階層化による設計の整理を検討してください。');
                }
                
                if (wires.length > gates.length * 2) {
                    suggestions.push('配線が多いです。バス構造の採用を検討してください。');
                }
                
                if (inputs.length === 0) {
                    suggestions.push('入力ゲートがありません。INPUTゲートを追加してください。');
                }
                
                if (outputs.length === 0) {
                    suggestions.push('出力ゲートがありません。OUTPUTゲートを追加してください。');
                }
                
                if (gateTypes['NOT'] > gates.length * 0.3) {
                    suggestions.push('NOTゲートが多いです。NAND/NORゲートの活用を検討してください。');
                }
                
                if (gateTypes['XOR'] > 5) {
                    suggestions.push('XORゲートが多用されています。専用回路への置き換えを検討してください。');
                }
                
                // 未接続ゲートの検出
                const unconnectedGates = gates.filter(gate => {
                    const hasInput = wires.some(w => w.endGateId === gate.id);
                    const hasOutput = wires.some(w => w.startGateId === gate.id);
                    return gate.type !== 'INPUT' && gate.type !== 'OUTPUT' && (!hasInput || !hasOutput);
                });
                
                if (unconnectedGates.length > 0) {
                    suggestions.push(`${unconnectedGates.length}個の未接続ゲートがあります。配線を確認してください。`);
                }
                
                return suggestions;
                
            } catch (error) {
                console.error('最適化提案生成エラー:', error);
                return ['分析中にエラーが発生しました。'];
            }
        }

        function executeAIOptimization() {
            try {
                const opportunities = pro13AI.detectOptimizationOpportunities();
                
                let resultHtml = `
                    <div style="background: linear-gradient(135deg, #e91e63 0%, #ff5722 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">🔧 最適化分析結果</h3>
                    </div>
                    
                    <div style="display: grid; gap: 10px;">
                `;
                
                if (!opportunities || opportunities.length === 0) {
                    resultHtml += `
                        <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
                            <strong>✅ 最適化状況良好</strong><br>
                            現在の回路に明らかな最適化ポイントは見つかりませんでした。
                        </div>
                    `;
                } else {
                    opportunities.forEach((opp, index) => {
                        resultHtml += `
                            <div style="background: #fff3cd; padding: 10px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 8px;">
                                <strong>🎯 最適化機会 ${index + 1}</strong><br>
                                <strong>種類:</strong> ${opp.type || 'N/A'}<br>
                                <strong>説明:</strong> ${opp.description || 'N/A'}<br>
                                <strong>影響:</strong> ${opp.impact || 'N/A'}<br>
                                <strong>対象ゲート:</strong> ${(opp.gates || []).join(', ') || 'N/A'}
                            </div>
                        `;
                    });
                }
                
                resultHtml += '</div>';
                
                showConfigDialog('AI最適化提案', resultHtml, function() { return true; });
                status.textContent = `最適化分析完了: ${opportunities.length}件の改善機会を発見`;
            } catch (error) {
                console.error('最適化分析エラー:', error);
                alert('最適化分析中にエラーが発生しました: ' + error.message);
            }
        }

        function showLearningResources() {
            try {
                const resources = pro13AI.learningResources;
                
                let resultHtml = `
                    <div style="background: linear-gradient(135deg, #673ab7 0%, #9c27b0 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">📚 学習リソース</h3>
                    </div>
                    
                    <div style="display: grid; gap: 10px;">
                `;
                
                if (resources && resources.size > 0) {
                    for (const [category, tips] of resources) {
                        resultHtml += `
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; border-left: 4px solid #673ab7;">
                                <strong style="color: #673ab7;">📖 ${category}</strong><br>
                                ${(tips || []).map(tip => `• ${tip}`).join('<br>')}
                            </div>
                        `;
                    }
                } else {
                    resultHtml += `
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <strong>📚 学習リソースを読み込み中...</strong><br>
                            AIシステムが初期化中です。しばらくお待ちください。
                        </div>
                    `;
                }
                
                resultHtml += '</div>';
                
                showConfigDialog('学習リソース', resultHtml, function() { return true; });
            } catch (error) {
                console.error('学習リソースエラー:', error);
                alert('学習リソースの表示中にエラーが発生しました: ' + error.message);
            }
        }

        function executeAIDesign() {
            try {
                const requirement = document.getElementById('designRequirement')?.value || '';
                
                if (!requirement.trim()) {
                    alert('設計要求を入力してください');
                    return;
                }
                
                // より高度なAI設計（自然言語解析風）
                let suggestion = '';
                let autoGenerate = false;
                
                const req = requirement.toLowerCase();
                console.log('AI Design Analysis:', req);
                
                // 詳細解析と適切な回路生成
                if (req.includes('alu') || req.includes('演算') || req.includes('加算') || req.includes('adder') || 
                    req.includes('論理演算') || req.includes('arithmetic')) {
                    if (req.includes('多機能') || req.includes('複数演算') || req.includes('and') || req.includes('or')) {
                        // 多機能ALU生成
                        generateALUCircuit(true);
                        autoGenerate = true;
                        suggestion = `
                            <div style="background: #cce5ff; padding: 15px; border-radius: 8px;">
                                <strong>🧮 多機能ALU回路を生成</strong><br>
                                4bit多機能ALUを配置・配線しました。<br><br>
                                <strong>対応演算:</strong><br>
                                • AND演算 (論理積)<br>
                                • OR演算 (論理和)<br>
                                • XOR演算 (排他的論理和)<br>
                                • NOT演算 (論理否定)<br>
                                • ADD演算 (加算)<br>
                                • 演算選択 (Op0, Op1制御)<br><br>
                                演算種別は制御信号Op0, Op1で選択できます。
                            </div>
                        `;
                    } else {
                        // 基本ALU生成
                        addGate('INPUT', 100, 100); // A
                        addGate('INPUT', 100, 150); // B
                        addGate('FULL_ADDER', 200, 125);
                        addGate('OUTPUT', 300, 125); // Sum
                        addGate('OUTPUT', 300, 175); // Carry
                        suggestion = `
                            <div style="background: #cce5ff; padding: 15px; border-radius: 8px;">
                                <strong>➕ 基本加算器を生成</strong><br>
                                1bit全加算器を配置しました。配線してお使いください。
                            </div>
                        `;
                    }
                } else if (req.includes('カウンタ') || req.includes('counter') || req.includes('count')) {
                    if (req.includes('8bit') || req.includes('8ビット')) {
                        // 8bitカウンタ（拡張版）
                        for (let i = 0; i < 8; i++) {
                            addGate('D_FF', 150 + i*80, 200);
                        }
                        addGate('INPUT', 50, 200); // CLK
                        addGate('INPUT', 50, 250); // Reset
                        for (let i = 0; i < 8; i++) {
                            addGate('OUTPUT', 150 + i*80, 300);
                        }
                        suggestion = `
                            <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
                                <strong>🔄 8bitカウンタを生成</strong><br>
                                8bitリップルカウンタを配置しました。0-255の範囲でカウントします。
                            </div>
                        `;
                    } else {
                        // 4bitカウンタ（標準）
                        generateCounterCircuit(true);
                        autoGenerate = true;
                        suggestion = generateCounterCircuit(false);
                    }
                } else if (req.includes('メモリ') || req.includes('memory') || req.includes('ram') || req.includes('レジスタ')) {
                    if (req.includes('16bit') || req.includes('16ビット')) {
                        // 16bitメモリ
                        for (let i = 0; i < 16; i++) {
                            addGate('D_FF', 100 + (i%8)*70, 150 + Math.floor(i/8)*100);
                        }
                        addGate('INPUT', 50, 200); // CLK
                        addGate('INPUT', 50, 250); // WE
                        addGate('DECODER', 300, 200);
                        addGate('MUX', 400, 200);
                        suggestion = `
                            <div style="background: #ffe6cc; padding: 15px; border-radius: 8px;">
                                <strong>  16bitメモリを生成</strong><br>
                                16bitレジスタメモリを配置しました。配線してお使いください。
                            </div>
                        `;
                    } else {
                        // 標準メモリ
                        generateMemoryCircuit(true);
                        autoGenerate = true;
                        suggestion = generateMemoryCircuit(false);
                    }
                } else if (req.includes('cpu') || req.includes('プロセッサ') || req.includes('マイクロプロセッサ')) {
                    generateCPUCircuit(true);
                    autoGenerate = true;
                    suggestion = `
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
                            <strong>🖥️ 簡易CPUを生成</strong><br>
                            8bit簡易CPUの基本構造を配置しました。各コンポーネントを配線して完成させてください。
                        </div>
                    `;
                } else if (req.includes('フリップフロップ') || req.includes('ff') || req.includes('d-ff') || req.includes('記憶')) {
                    const bitCount = req.match(/(\d+)bit/) ? parseInt(req.match(/(\d+)bit/)[1]) : 1;
                    for (let i = 0; i < Math.min(bitCount, 8); i++) {
                        addGate('D_FF', 200 + i*100, 200);
                        addGate('INPUT', 100, 180 + i*40); // D input
                        addGate('OUTPUT', 300 + i*100, 200); // Q output
                    }
                    addGate('INPUT', 100, 150); // CLK
                    suggestion = `
                        <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
                            <strong>🔄 ${bitCount}bit記憶素子を生成</strong><br>
                            D-フリップフロップを${Math.min(bitCount, 8)}個配置しました。
                        </div>
                    `;
                } else if (req.includes('デコーダ') || req.includes('decoder')) {
                    addGate('DECODER', 200, 200);
                    addGate('INPUT', 100, 180); // A0
                    addGate('INPUT', 100, 200); // A1  
                    addGate('INPUT', 100, 220); // A2
                    for (let i = 0; i < 8; i++) {
                        addGate('OUTPUT', 300, 150 + i*25);
                    }
                    suggestion = `
                        <div style="background: #e6f3ff; padding: 15px; border-radius: 8px;">
                            <strong>🔀 3to8デコーダを生成</strong><br>
                            3bit入力を8bit出力に変換するデコーダを配置しました。
                        </div>
                    `;
                } else {
                    // 一般的なアドバイス
                    suggestion = `
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
                            <strong>🤖 AI設計解析</strong><br>
                            「${requirement}」を解析しましたが、具体的な回路パターンが特定できませんでした。<br><br>
                            
                            <strong>より具体的なキーワード例:</strong><br>
                            • 「4bit ALU」「多機能ALU」<br>
                            • 「8bitカウンタ」「リップルカウンタ」<br>
                            • 「16bitメモリ」「レジスタファイル」<br>
                            • 「簡易CPU」「マイクロプロセッサ」<br>
                            • 「8bit フリップフロップ」<br>
                            • 「3to8デコーダ」
                        </div>
                    `;
                }
                
                const statusMsg = autoGenerate ? '設計要求に基づき回路を自動生成しました' : '回路要素を配置しました';
                
                showConfigDialog('AI設計結果', `
                    <div style="background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">🎨 AI設計結果</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">要求: "${requirement}"</p>
                    </div>
                    ${suggestion}
                `, function() { return true; });
                
                status.textContent = statusMsg;
                
            } catch (error) {
                console.error('AI設計エラー:', error);
                alert('AI設計中にエラーが発生しました: ' + error.message);
            }
        }

        function generateCounterCircuit(autoPlace = true) {
            const pattern = pro13AI.generateCircuitPattern('counter');
            console.log('Counter pattern:', pattern);
            let gateIdMap = {};
            if (autoPlace) {
                // ゲート配置
                pattern.layout.forEach((gateInfo, idx) => {
                    addGate(gateInfo.type, gateInfo.x, gateInfo.y);
                    // 直近追加ゲートのIDを記録
                    gateIdMap[idx] = gates[gates.length - 1].id;
                    console.log(`Gate ${idx}: ${gateInfo.type} -> ID ${gateIdMap[idx]}`);
                });
                // 配線情報があれば自動で接続
                if (pattern.wires && Array.isArray(pattern.wires)) {
                    console.log(`Creating ${pattern.wires.length} wires...`);
                    pattern.wires.forEach((wire, idx) => {
                        // wire: {from: idx, fromPin, to: idx, toPin}
                        const fromGate = gates.find(g => g.id === gateIdMap[wire.from]);
                        const toGate = gates.find(g => g.id === gateIdMap[wire.to]);
                        console.log(`Wire ${idx}: gate${wire.from}(${fromGate?.type}) pin${wire.fromPin} -> gate${wire.to}(${toGate?.type}) pin${wire.toPin}`);
                        if (fromGate && toGate) {
                            createWire(fromGate, wire.fromPin || 0, toGate, wire.toPin || 0);
                        } else {
                            console.error(`Wire creation failed: fromGate=${fromGate}, toGate=${toGate}`);
                        }
                    });
                } else {
                    console.log('No wires found in pattern');
                }
                status.textContent = 'AI生成: 4bitカウンタ回路を配置・配線しました';
            }
            return `
                <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
                    <strong>4bitカウンタ設計</strong><br>
                    ${pattern.description}<br><br>
                    
                    <strong>使用ゲート:</strong><br>
                    ${pattern.gates.map(gate => `• ${gate}`).join('<br>')}<br><br>
                    
                    <strong>設計ポイント:</strong><br>
                    • クロック信号で同期動作<br>
                    • リセット機能付き<br>
                    • 0-15の範囲でカウント
                </div>
            `;
        }

        function generateALUCircuit(autoPlace = true) {
            const pattern = pro13AI.generateCircuitPattern('alu');
            console.log('ALU pattern:', pattern);
            let gateIdMap = {};
            if (autoPlace) {
                pattern.layout.forEach((gateInfo, idx) => {
                    addGate(gateInfo.type, gateInfo.x, gateInfo.y);
                    gateIdMap[idx] = gates[gates.length - 1].id;
                    console.log(`Gate ${idx}: ${gateInfo.type} -> ID ${gateIdMap[idx]}`);
                });
                if (pattern.wires && Array.isArray(pattern.wires)) {
                    console.log(`Creating ${pattern.wires.length} wires...`);
                    pattern.wires.forEach((wire, idx) => {
                        const fromGate = gates.find(g => g.id === gateIdMap[wire.from]);
                        const toGate = gates.find(g => g.id === gateIdMap[wire.to]);
                        console.log(`Wire ${idx}: gate${wire.from}(${fromGate?.type}) pin${wire.fromPin} -> gate${wire.to}(${toGate?.type}) pin${wire.toPin}`);
                        if (fromGate && toGate) {
                            createWire(fromGate, wire.fromPin || 0, toGate, wire.toPin || 0);
                        } else {
                            console.error(`Wire creation failed: fromGate=${fromGate}, toGate=${toGate}`);
                        }
                    });
                } else {
                    console.log('No wires found in pattern');
                }
                status.textContent = 'AI生成: 簡易ALU回路を配置・配線しました';
            }
            return `
                <div style="background: #cce5ff; padding: 15px; border-radius: 8px;">
                    <strong>🧮 簡易ALU設計</strong><br>
                    ${pattern.description}<br><br>
                    
                    <strong>使用ゲート:</strong><br>
                    ${pattern.gates.map(gate => `• ${gate}`).join('<br>')}<br><br>
                    
                    <strong>機能:</strong><br>
                    • 加算演算<br>
                    • 論理AND演算<br>
                    • 論理OR演算<br>
                    • XOR演算
                </div>
            `;
        }

        function generateMemoryCircuit(autoPlace = true) {
            const pattern = pro13AI.generateCircuitPattern('memory');
            console.log('Memory pattern:', pattern);
            let gateIdMap = {};
            if (autoPlace) {
                pattern.layout.forEach((gateInfo, idx) => {
                    addGate(gateInfo.type, gateInfo.x, gateInfo.y);
                    gateIdMap[idx] = gates[gates.length - 1].id;
                    console.log(`Gate ${idx}: ${gateInfo.type} -> ID ${gateIdMap[idx]}`);
                });
                if (pattern.wires && Array.isArray(pattern.wires)) {
                    console.log(`Creating ${pattern.wires.length} wires...`);
                    pattern.wires.forEach((wire, idx) => {
                        const fromGate = gates.find(g => g.id === gateIdMap[wire.from]);
                        const toGate = gates.find(g => g.id === gateIdMap[wire.to]);
                        console.log(`Wire ${idx}: gate${wire.from}(${fromGate?.type}) pin${wire.fromPin} -> gate${wire.to}(${toGate?.type}) pin${wire.toPin}`);
                        if (fromGate && toGate) {
                            createWire(fromGate, wire.fromPin || 0, toGate, wire.toPin || 0);
                        } else {
                            console.error(`Wire creation failed: fromGate=${fromGate}, toGate=${toGate}`);
                        }
                    });
                } else {
                    console.log('No wires found in pattern');
                }
                status.textContent = 'AI生成: 4bitメモリ回路を配置・配線しました';
            }
            return `
                <div style="background: #ffe6cc; padding: 15px; border-radius: 8px;">
                    <strong>💾 4bitメモリ設計</strong><br>
                    ${pattern.description}<br><br>
                    
                    <strong>使用ゲート:</strong><br>
                    ${pattern.gates.map(gate => `• ${gate}`).join('<br>')}<br><br>
                    
                    <strong>機能:</strong><br>
                    • データの読み書き<br>
                    • アドレス指定<br>
                    • 書き込み制御
                </div>
            `;
        }

        function generateCPUCircuit(autoPlace = true) {
            if (autoPlace) {
                // 簡易8bitCPUを実際に生成
                // Program Counter
                addGate('D_FF', 150, 100); // PC0
                addGate('D_FF', 150, 150); // PC1
                addGate('D_FF', 150, 200); // PC2
                addGate('INPUT', 50, 150);  // CLK
                
                // Instruction Register
                addGate('D_FF', 300, 100); // IR0
                addGate('D_FF', 300, 150); // IR1
                addGate('D_FF', 300, 200); // IR2
                addGate('D_FF', 300, 250); // IR3
                
                // ALU components
                addGate('FULL_ADDER', 500, 150); // ALU
                addGate('AND', 500, 200);        // Logic unit
                addGate('OR', 500, 250);         // Logic unit
                
                // Register File
                addGate('D_FF', 700, 100); // Reg A
                addGate('D_FF', 700, 150); // Reg B
                addGate('D_FF', 700, 200); // Reg C
                
                // Control signals
                addGate('INPUT', 50, 300);  // Reset
                addGate('INPUT', 50, 350);  // Enable
                
                // Outputs
                addGate('OUTPUT', 850, 150); // Data out
                addGate('OUTPUT', 850, 200); // Status
                
                status.textContent = 'AI生成: 簡易8bitCPU回路を配置しました（手動配線が必要）';
            }
            
            showConfigDialog('CPU設計', `
                <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                    <h3 style="margin: 0;">🖥️ 簡易CPU設計</h3>
                </div>
                
                <div style="background: #d4edda; padding: 15px; border-radius: 8px;">
                    <strong>✅ CPU基本構造を生成しました</strong><br><br>
                    
                    <strong>生成された要素:</strong><br>
                    • プログラムカウンタ (3bit)<br>
                    • 命令レジスタ (4bit)<br>
                    • ALU (加算・論理演算)<br>
                    • レジスタファイル (3個)<br>
                    • 制御信号 (CLK, Reset, Enable)<br>
                    • 出力 (Data, Status)<br><br>
                    
                    <strong>次のステップ:</strong><br>
                    1. 配線して各コンポーネントを接続<br>
                    2. 制御ロジックを追加<br>
                    3. 命令セットを定義<br>
                    4. テストパターンで動作確認
                </div>
            `, function() { return true; });
        }

        function executeDelayAnalysis() {
            try {
                if (gates.length === 0) {
                    alert('回路が空です。ゲートを配置してから分析してください。');
                    return;
                }
                
                const gateDelays = {
                    'INPUT': 0,
                    'OUTPUT': 0.1,
                    'AND': 0.5,
                    'OR': 0.6,
                    'NOT': 0.3,
                    'NAND': 0.4,
                    'NOR': 0.5,
                    'XOR': 0.8,
                    'D_FF': 1.2,
                    'FULL_ADDER': 1.0,
                    'MUX': 0.7,
                    'DECODER': 0.9
                };
                
                // 各ゲートの累積遅延を計算
                const cumulativeDelays = new Map();
                const inputs = gates.filter(g => g.type === 'INPUT');
                
                // 入力ゲートの遅延は0
                inputs.forEach(gate => cumulativeDelays.set(gate.id, 0));
                
                let changed = true;
                let iterations = 0;
                const maxIterations = 100;
                
                while (changed && iterations < maxIterations) {
                    changed = false;
                    iterations++;
                    
                    gates.forEach(gate => {
                        if (gate.type === 'INPUT') return;
                        
                        const inputWires = wires.filter(w => w.endGateId === gate.id);
                        if (inputWires.length === 0) return;
                        
                        const inputDelays = inputWires.map(wire => {
                            const sourceGate = gates.find(g => g.id === wire.startGateId);
                            return cumulativeDelays.get(sourceGate?.id) || 0;
                        });
                        
                        if (inputDelays.every(delay => delay !== undefined)) {
                            const maxInputDelay = Math.max(...inputDelays);
                            const gateDelay = gateDelays[gate.type] || 0.5;
                            const newDelay = maxInputDelay + gateDelay;
                            const currentDelay = cumulativeDelays.get(gate.id);
                            
                            if (currentDelay === undefined || newDelay > currentDelay) {
                                cumulativeDelays.set(gate.id, newDelay);
                                changed = true;
                            }
                        }
                    });
                }
                
                const outputs = gates.filter(g => g.type === 'OUTPUT');
                const outputDelays = outputs.map(gate => {
                    const inputWires = wires.filter(w => w.endGateId === gate.id);
                    if (inputWires.length > 0) {
                        const sourceGate = gates.find(g => g.id === inputWires[0].startGateId);
                        return cumulativeDelays.get(sourceGate?.id) || 0;
                    }
                    return 0;
                });
                
                const maxDelay = Math.max(...Array.from(cumulativeDelays.values()), 0);
                const criticalPath = Array.from(cumulativeDelays.entries())
                    .filter(([_, delay]) => delay === maxDelay)
                    .map(([gateId, _]) => gates.find(g => g.id === gateId)?.type || 'UNKNOWN');
                
                const frequencyMHz = maxDelay > 0 ? (1000 / maxDelay).toFixed(1) : 'N/A';
                
                showConfigDialog('遅延分析結果', `
                    <div style="background: linear-gradient(135deg, #795548 0%, #5d4037 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">⏱️ 遅延分析結果</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">回路のタイミング特性解析</p>
                    </div>
                    
                    <div style="display: grid; gap: 10px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 5px solid #795548;">
                            <strong>📊 遅延統計</strong><br>
                            最大遅延: <span style="color: #d84315; font-weight: bold;">${maxDelay.toFixed(2)}</span> ns<br>
                            推定最大周波数: <span style="color: #d84315; font-weight: bold;">${frequencyMHz}</span> MHz<br>
                            クリティカルパス段数: <span style="color: #d84315; font-weight: bold;">${criticalPath.length}</span><br>
                            解析対象ゲート数: <span style="color: #d84315; font-weight: bold;">${gates.length}</span>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 5px solid #ffc107;">
                            <strong>🛣️ クリティカルパス</strong><br>
                            ${criticalPath.length > 0 ? 
                                criticalPath.map((type, i) => `${i + 1}. ${type}`).join('<br>') :
                                '単純な回路構造です。'
                            }
                        </div>
                        
                        <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 5px solid #28a745;">
                            <strong>💡 最適化提案</strong><br>
                            ${maxDelay > 5 ? 
                                '• パイプライン化による高速化を検討<br>• 並列処理によるスループット向上' :
                                maxDelay > 2 ? 
                                '• ゲートレベル最適化を検討<br>• クリティカルパスの短縮' :
                                '✅ 良好な遅延特性です。'
                            }
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 5px solid #2196f3;">
                            <strong>📈 出力別遅延</strong><br>
                            ${outputs.map((output, i) => 
                                `出力${i}: ${outputDelays[i] ? outputDelays[i].toFixed(2) : '0.00'} ns`
                            ).join('<br>') || '出力ゲートがありません。'}
                        </div>
                    </div>
                `, function() { return true; });
                
                status.textContent = `遅延分析完了: 最大${maxDelay.toFixed(2)}ns, 最大${frequencyMHz}MHz`;
                
            } catch (error) {
                console.error('遅延分析エラー:', error);
                alert('遅延分析中にエラーが発生しました: ' + error.message);
            }
        }

        function executePowerAnalysis() {
            try {
                if (gates.length === 0) {
                    alert('回路が空です。ゲートを配置してから分析してください。');
                    return;
                }
                
                const gatePowerStatic = {
                    'INPUT': 0.05, 'OUTPUT': 0.05, 'AND': 0.8, 'OR': 0.9, 'NOT': 0.4,
                    'NAND': 0.6, 'NOR': 0.7, 'XOR': 1.2, 'D_FF': 2.5, 'FULL_ADDER': 1.8,
                    'MUX': 1.1, 'DECODER': 1.5
                };
                
                const gatePowerDynamic = {
                    'INPUT': 0.1, 'OUTPUT': 0.1, 'AND': 1.5, 'OR': 1.3, 'NOT': 0.8,
                    'NAND': 1.2, 'NOR': 1.1, 'XOR': 2.0, 'D_FF': 4.0, 'FULL_ADDER': 3.2,
                    'MUX': 2.5, 'DECODER': 2.8
                };
                
                let staticPower = 0;
                let dynamicPower = 0;
                const powerBreakdown = {};
                
                gates.forEach(gate => {
                    const staticP = gatePowerStatic[gate.type] || 0.5;
                    const dynamicP = gatePowerDynamic[gate.type] || 1.0;
                    
                    staticPower += staticP;
                    dynamicPower += dynamicP;
                    
                    if (!powerBreakdown[gate.type]) {
                        powerBreakdown[gate.type] = { count: 0, static: 0, dynamic: 0 };
                    }
                    powerBreakdown[gate.type].count++;
                    powerBreakdown[gate.type].static += staticP;
                    powerBreakdown[gate.type].dynamic += dynamicP;
                });
                
                const totalPower = staticPower + dynamicPower;
                const powerDensity = totalPower / Math.max(gates.length, 1);
                
                let efficiency = 'N/A';
                if (gates.length > 0) {
                    const complexity = Math.ceil(gates.length / 10) + Math.ceil(wires.length / 15);
                    const powerEfficiency = complexity / totalPower;
                    
                    if (powerEfficiency > 2) efficiency = '優秀';
                    else if (powerEfficiency > 1) efficiency = '良好';
                    else if (powerEfficiency > 0.5) efficiency = '標準';
                    else efficiency = '要改善';
                }
                
                showConfigDialog('電力分析結果', `
                    <div style="background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px; color: white;">
                        <h3 style="margin: 0;">⚡ 電力分析結果</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">回路の消費電力特性解析</p>
                    </div>
                    
                    <div style="display: grid; gap: 10px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 5px solid #ff5722;">
                            <strong>📊 電力統計</strong><br>
                            静的電力: <span style="color: #d84315; font-weight: bold;">${staticPower.toFixed(2)}</span> mW<br>
                            動的電力: <span style="color: #d84315; font-weight: bold;">${dynamicPower.toFixed(2)}</span> mW<br>
                            総消費電力: <span style="color: #d84315; font-weight: bold;">${totalPower.toFixed(2)}</span> mW<br>
                            電力密度: <span style="color: #d84315; font-weight: bold;">${powerDensity.toFixed(3)}</span> mW/ゲート
                        </div>
                        
                        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 5px solid #4caf50;">
                            <strong>🎯 効率性評価</strong><br>
                            電力効率性: <span style="color: #2e7d32; font-weight: bold;">${efficiency}</span><br>
                            静的/動的比: <span style="color: #2e7d32; font-weight: bold;">${(staticPower/dynamicPower).toFixed(2)}</span><br>
                            ${efficiency === '要改善' ? 
                                '<span style="color: #d32f2f;">⚠️ 高消費電力回路です。最適化を検討してください。</span>' :
                                '<span style="color: #2e7d32;">✅ 適切な電力特性です。</span>'
                            }
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 5px solid #ffc107;">
                            <strong>🔋 ゲート種別電力内訳</strong><br>
                            ${Object.entries(powerBreakdown).map(([type, data]) =>
                                `${type} (${data.count}個): ${(data.static + data.dynamic).toFixed(2)}mW`
                            ).join('<br>')}
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 5px solid #2196f3;">
                            <strong>💡 省電力化提案</strong><br>
                            ${totalPower > 20 ? 
                                '• クロックゲーティングの導入<br>• 低電力ゲートライブラリの採用<br>• 電力アイランド化の検討' :
                                totalPower > 10 ?
                                '• 動的電力管理の導入<br>• 使用頻度の低い回路の電源制御' :
                                '✅ 低消費電力設計です。'
                            }
                        </div>
                    </div>
                `, function() { return true; });
                
                status.textContent = `電力分析完了: 総${totalPower.toFixed(2)}mW (静的:${staticPower.toFixed(1)}mW + 動的:${dynamicPower.toFixed(1)}mW)`;
                
            } catch (error) {
                console.error('電力分析エラー:', error);
                alert('電力分析中にエラーが発生しました: ' + error.message);
            }
        }

        function executeErrorDetection() {
            try {
                if (gates.length === 0) {
                    alert('回路が空です。ゲートを配置してから分析してください。');
                    return;
                }
                
                const errors = [];
                
                // 基本的なエラーチェック
                gates.forEach(gate => {
                    if (gate.type !== 'INPUT' && gate.type !== 'PUSH_BUTTON' && gate.type !== 'TOGGLE_BUTTON') {
                        const inputWires = wires.filter(w => w.inputGate === gate.id);
                        if (inputWires.length === 0) {
                            errors.push({
                                type: 'disconnected_input',
                                message: `${gate.type} (ID:${gate.id}) の入力が接続されていません`,
                                severity: 'warning'
                            });
                        }
                    }
                });
                
                // 結果の表示
                const message = errors.length === 0 ? 
                    'エラーなし: 回路に明らかなエラーは検出されませんでした。':
                    'エラー検出完了: ' + errors.length + '件の問題を発見しました。';
                
                alert(message);
                status.textContent = 'エラー検出完了: ' + errors.length + '件の問題を発見';
                
            } catch (error) {
                console.error('エラー検出エラー:', error);
                alert('エラー検出中にエラーが発生しました');
            }
        }

        function generateOptimizationSuggestions() {
            const opportunities = pro13AI.detectOptimizationOpportunities();
            const analysis = pro13AI.analyzeCircuit();
            
            let suggestions = [];
            
            // 基本的な最適化提案
            if (analysis.gateCount > 20) {
                suggestions.push({
                    title: '回路の階層化',
                    description: 'サブ回路やモジュールに分割することで保守性が向上します',
                    benefit: '可読性・保守性の向上'
                });
            }
            
            if (analysis.criticalPath > 8) {
                suggestions.push({
                    title: 'パイプライン化',
                    description: 'レジスタを挿入して処理を分割し、動作周波数を向上させます',
                    benefit: '動作周波数の向上'
                });
            }
            
            const gateTypes = analysis.gateTypes;
            if (gateTypes['NOT'] > analysis.gateCount * 0.2) {
                suggestions.push({
                    title: 'ド・モルガンの法則適用',
                    description: 'NOT ゲートを削減し、NAND/NOR ゲートを活用します',
                    benefit: 'ゲート数削減'
                });
            }
            
            // 機会ベースの提案
            opportunities.forEach(opp => {
                suggestions.push({
                    title: opp.description,
                    description: '対象ゲート: ' + opp.gates.join(', '),
                    benefit: opp.impact
                });
            });
            
            // 結果の表示（簡単なアラート形式）
            if (suggestions.length === 0) {
                alert('最適化済み: 現在の回路構成は適切です。追加の最適化は必要ありません。');
            } else {
                const message = '最適化提案 (' + suggestions.length + '件):\\n\\n' +
                    suggestions.map(s => s.title + '\\n- ' + s.description + '\\n- 効果: ' + s.benefit).join('\\n\\n');
                alert(message);
            }
            
            status.textContent = '最適化分析完了: ' + suggestions.length + '件の提案';
        }
        function generateFromTruthTable() {
            const input = prompt('真理値表を入力してください\\n例: 2入力AND\\n00→0, 01→0, 10→0, 11→1');
            if (input) {
                alert('真理値表から論理回路を生成する機能は実装中です。\\n入力: ' + input);
            }
        }

        function generateFromLogicExpression() {
            const expression = prompt('論理式を入力してください\\n例: A AND B OR (NOT C)');
            if (expression) {
                alert('論理式から回路を生成する機能は実装中です。\\n式: ' + expression);
            }
        }

        function generateOptimizedGate() {
            executeKarnaughMapOptimization();
        }


        function generateFromHDL() {
            const hdl = prompt('HDLコードを入力してください\\n(Verilog/VHDL形式)');
            if (hdl) {
                alert('HDLから回路を生成する機能は実装中です。\\nコード: ' + hdl);
            }
        }

        function executeTruthTableGeneration() {
            alert('真理値表からの回路生成機能は実装中です。');
        }

        function parseTruthTable(input) {
            alert('真理値表解析機能は実装中です。');
            return { table: [], inputs: 2, outputs: 1 };
        }

        function generateLogicFromTruthTable(parsedTable) {
            alert('真理値表からの論理生成機能は実装中です。');
        }

        function executeLogicExpressionGeneration() {
            alert('論理式からの回路生成機能は実装中です。');
        }

        function parseLogicExpression(expression) {
            alert('論理式解析機能は実装中です。');
            return { expression: '', variables: [] };
        }

        function generateLogicFromExpression(parsedExpr) {
            alert('論理式からの生成機能は実装中です。');
            return { code: '', function: null };
        }

        function parseAndGenerateFromHDL() {
            alert('HDL解析・生成機能は実装中です。');

            try {
                const parsedHDL = parseSimpleHDL(hdlCode);
                const gateInfo = {
                    inputs: parsedHDL.inputs.length,
                    outputs: parsedHDL.outputs.length,
                width: Math.max(100, parsedHDL.moduleName.length * 8),
                height: Math.max(60, Math.max(parsedHDL.inputs.length, parsedHDL.outputs.length) * 15 + 30)
            };

            updateCustomGatesList();
            alert('真理値表からカスタムゲートを生成しました');

            } catch (error) {
                alert('真理値表の解析に失敗しました: ' + error.message);
        }
        }

        function parseTruthTable(input) {
            const lines = input.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            const table = [];
            let maxInputs = 0;
            let maxOutputs = 0;
            
            for (const line of lines) {
                const match = line.match(/([01]+)\s*[→\->]\s*([01]+)/);
                if (match) {
                    const inputs = match[1].split('').map(Number);
                    const outputs = match[2].split('').map(Number);
                    table.push({ inputs, outputs });
                    maxInputs = Math.max(maxInputs, inputs.length);
                    maxOutputs = Math.max(maxOutputs, outputs.length);
                }
            }
            
            if (table.length === 0) {
                throw new Error('有効な真理値表エントリが見つかりません (例: 01→1)');
            }
            
            return { table, inputs: maxInputs, outputs: maxOutputs };
        }

        function generateLogicFromTruthTable(parsedTable) {
            alert('真理値表からの論理生成機能は実装中です。');
        }

        function executeLogicExpressionGeneration() {
            alert('論理式からの回路生成機能は実装中です。');
        }

        function parseLogicExpression(expression) {
            alert('論理式解析機能は実装中です。');
            return { expression: '', variables: [] };
        }

        function generateLogicFromExpression(parsedExpr) {
            alert('論理式からの生成機能は実装中です。');
            return { code: '', function: null };
        }



        function parseSimpleHDL(hdlCode) {
            // 簡易HDLパーサー
            const moduleMatch = hdlCode.match(/module\s+(\w+)\s*\((.*?)\)/);
            if (!moduleMatch) {
                throw new Error('module宣言が見つかりません');
            }
            
            const moduleName = moduleMatch[1];
            const ports = moduleMatch[2].split(',').map(p => p.trim());
            
            const inputs = [];
            const outputs = [];
            
            for (const port of ports) {
                if (port.includes('input')) {
                    const name = port.replace(/input\s+/, '').trim();
                    inputs.push(name);
                } else if (port.includes('output')) {
                    const name = port.replace(/output\s+/, '').trim();
                    outputs.push(name);
                }
            }
            
            const assignMatch = hdlCode.match(/assign\s+(\w+)\s*=\s*([^;]+);/);
            let logic = 'outputs[0] = inputs[0] || 0;'; // デフォルト
            
            if (assignMatch) {
                const assignExpr = assignMatch[2].trim();
                logic = convertHDLToJS(assignExpr, inputs, outputs);
            }
            
            return { moduleName, inputs, outputs, logic };
        }

        function convertHDLToJS(hdlExpr, inputs, outputs) {
            // HDL式をJavaScriptに変換
            let jsExpr = hdlExpr
                .replace(/&/g, '&&')
                .replace(/\|/g, '||')
                .replace(/~/g, '!')
                .replace(/\^/g, '!==');
            
            // 入力変数をinputs配列への参照に変換
            inputs.forEach((input, i) => {
                const regex = new RegExp(`\\b${input}\\b`, 'g');
                jsExpr = jsExpr.replace(regex, `inputs[${i}]`);
            });
            
            return `let outputs = [${jsExpr} ? 1 : 0]; return outputs;`;
        }
        function executeKarnaughMapOptimization() {
            try {
                alert('カルノー図最適化機能は実装中です。');
                
                const suggestions = [];
                
                // NORゲートの最適化チェック
                const norGates = gates.filter(g => g.type === 'NOR');
                if (norGates.length > 0) {
                    suggestions.push('NOR + NOT → NAND への変換でゲート数削減可能');
                }
                
                // 二重否定の検出
                const notGates = gates.filter(g => g.type === 'NOT');
                let doubleNots = 0;
                
                notGates.forEach(notGate => {
                    const connectedNots = wires.filter(w => 
                        w.outputGate === notGate.id && 
                        gates.find(g => g.id === w.inputGate && g.type === 'NOT')
                    );
                    doubleNots += connectedNots.length;
                });
                
                if (doubleNots > 0) {
                    suggestions.push(doubleNots + '個の二重否定を削除できます');
                }
                
                const message = suggestions.length > 0 ?
                    'カルノー図最適化提案:\\n' + suggestions.join('\\n') :
                    '回路は既に最適化されています';
                alert(message);
                
            } catch (error) {
                console.error('カルノー図最適化エラー:', error);
                alert('カルノー図最適化中にエラーが発生しました');
            }
        }

        function generateAILogic(description, inputs, outputs) {
            return {
                code: '// AI生成スタブ',
                function: new Function('inputs', 'return new Array(' + outputs + ').fill(0);')
            };
        }

        function executeSmartGateGeneration() {
            try {
                const description = prompt('カスタムゲートの機能説明を入力してください') || '';
                const inputs = parseInt(prompt('入力数を入力してください (1-8)', '2') || '2');
                const outputs = parseInt(prompt('出力数を入力してください (1-8)', '1') || '1');
                
                if (isNaN(inputs) || isNaN(outputs) || inputs < 1 || outputs < 1) {
                    alert('有効な入力数・出力数を指定してください');
                    return;
                }
                
                // 実際にカスタムゲートを作成
                const gateName = 'AI_GATE_' + Date.now();
                const customType = 'CUSTOM_' + gateName;
                
                // AI分析によるロジック生成
                const aiLogic = generateAILogic(description, inputs, outputs);
                
                customGates[customType] = {
                    name: gateName,
                    description: description,
                    logic: aiLogic.code,
                    evaluate: aiLogic.function
                };
                
                GATE_SPECS[customType] = {
                    inputs: inputs,
                    outputs: outputs,
                    width: Math.max(60, gateName.length * 6),
                    height: Math.max(40, Math.max(inputs, outputs) * 15 + 20)
                };
                
                updateCustomGatesList();
                alert('カスタムゲートが生成されました: ' + gateName);
                
            } catch (error) {
                console.error('スマートゲート生成エラー:', error);
                alert('スマートゲート生成中にエラーが発生しました: ' + error.message);
            }
        }

        // Pro14物理エンジン制御機能（詳細表示切り替え）
        function togglePhysicsEngine() {
            physicsEngine.detailsVisible = !physicsEngine.detailsVisible;
            const btn = document.getElementById('physics-btn');
            const panel = document.getElementById('physics-details-panel');
            
            if (physicsEngine.detailsVisible) {
                panel.style.display = 'block';
                btn.style.background = '#4CAF50';
                btn.textContent = '物理🔬ON';
                status.textContent = '物理シミュレーション詳細パネルを表示中';
                startPhysicsDetailUpdates();
            } else {
                panel.style.display = 'none';
                btn.style.background = '#FF9800';
                btn.textContent = '物理🔬';
                status.textContent = '物理シミュレーション詳細パネルを非表示';
                stopPhysicsDetailUpdates();
            }
        }

        function hidePhysicsDetails() {
            physicsEngine.detailsVisible = false;
            document.getElementById('physics-details-panel').style.display = 'none';
            const btn = document.getElementById('physics-btn');
            btn.style.background = '#FF9800';
            btn.textContent = '物理🔬';
            stopPhysicsDetailUpdates();
        }

        let physicsDetailTimer = null;

        function startPhysicsDetailUpdates() {
            if (physicsDetailTimer) clearInterval(physicsDetailTimer);
            physicsDetailTimer = setInterval(updatePhysicsDetailsPanel, 100); // 10Hz更新
        }

        function stopPhysicsDetailUpdates() {
            if (physicsDetailTimer) {
                clearInterval(physicsDetailTimer);
                physicsDetailTimer = null;
            }
        }

        function updatePhysicsDetailsPanel() {
            if (!physicsEngine.detailsVisible) return;

            // FPS計算
            const currentFPS = Math.round(1000 / physicsEngine.timestep);
            document.getElementById('physics-fps').textContent = currentFPS;
            
            // 総ゲート数
            document.getElementById('total-gates').textContent = gates.length;
            
            // 環境パラメータ
            document.getElementById('global-temp').textContent = physicsEngine.temperature.toFixed(1) + '°C';
            document.getElementById('global-voltage').textContent = physicsEngine.voltage.toFixed(1) + 'V';
            
            // 総消費電力計算
            let totalPower = 0;
            gates.forEach(gate => {
                const physics = gatePhysics.get(gate.id);
                if (physics) totalPower += physics.power;
            });
            document.getElementById('total-power').textContent = (totalPower * 1000).toFixed(2) + 'mW';
            
            // 選択されたゲートの詳細
            updateSelectedGatePhysics();
            
            // タイミング解析
            updateTimingAnalysis();
            
            // 信号履歴チャート
            updateSignalChart();
            
            // リアルタイムログ
            updatePhysicsLog();
        }

        function updateSelectedGatePhysics() {
            const content = document.getElementById('selected-gate-physics');
            if (!selectedGate) {
                content.innerHTML = 'ゲートを選択してください';
                return;
            }
            
            const physics = gatePhysics.get(selectedGate.id);
            if (!physics) {
                content.innerHTML = '物理データが利用できません';
                return;
            }
            
            content.innerHTML = `
                <div><strong>ゲート:</strong> ${selectedGate.type} (ID: ${selectedGate.id})</div>
                <div><strong>温度:</strong> ${physics.temperature.toFixed(1)}°C</div>
                <div><strong>電圧:</strong> ${physics.voltage.toFixed(1)}V</div>
                <div><strong>消費電力:</strong> ${(physics.power * 1000).toFixed(2)}mW</div>
                <div><strong>伝播遅延:</strong> ${(physics.propagationDelay * 1000).toFixed(2)}ps</div>
                <div><strong>ファンアウト:</strong> ${physics.fanoutLoad}</div>
                <div><strong>熱雑音:</strong> ${(physics.thermalNoise * 1e6).toFixed(2)}µV</div>
            `;
        }

        function updateTimingAnalysis() {
            let maxDelay = 0;
            let minDelay = Infinity;
            let criticalPath = '未検出';
            
            gates.forEach(gate => {
                const physics = gatePhysics.get(gate.id);
                if (physics) {
                    maxDelay = Math.max(maxDelay, physics.propagationDelay);
                    minDelay = Math.min(minDelay, physics.propagationDelay);
                }
            });
            
            if (minDelay === Infinity) minDelay = 0;
            
            document.getElementById('max-delay').textContent = (maxDelay * 1000).toFixed(2) + 'ps';
            document.getElementById('min-delay').textContent = (minDelay * 1000).toFixed(2) + 'ps';
            document.getElementById('critical-path').textContent = criticalPath;
        }

        function updateSignalChart() {
            const canvas = document.getElementById('signal-chart');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // グリッド描画
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 28) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i < canvas.height; i += 20) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }
            
            // 選択されたゲートの信号波形
            if (selectedGate && signalHistory.has(selectedGate.id)) {
                const history = signalHistory.get(selectedGate.id);
                if (history.length > 1) {
                    ctx.strokeStyle = '#4CAF50';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    
                    history.slice(-50).forEach((point, index) => {
                        const x = (index / 49) * canvas.width;
                        const y = canvas.height - (point.outputs[0] * (canvas.height - 20)) - 10;
                        if (index === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    
                    ctx.stroke();
                }
            }
        }

        let physicsLogEntries = [];

        function addPhysicsLogEntry(message) {
            const timestamp = new Date().toLocaleTimeString();
            physicsLogEntries.unshift(`[${timestamp}] ${message}`);
            if (physicsLogEntries.length > 50) physicsLogEntries.length = 50;
        }

        function updatePhysicsLog() {
            const logContent = document.getElementById('physics-log-content');
            logContent.innerHTML = physicsLogEntries.map(entry => 
                `<div style="margin-bottom: 2px; font-size: 10px;">${entry}</div>`
            ).join('');
        }

        // Pro14初期化
        document.addEventListener('DOMContentLoaded', function() {
            // 物理エンジンの自動開始
            physicsEngine.enabled = true;
            physicsEngine.running = true;
            initPhysicsEngine();
            
            // 初期ログメッセージ
            addPhysicsLogEntry('物理シミュレーションエンジン開始');
            addPhysicsLogEntry(`初期設定: ${physicsEngine.temperature}°C, ${physicsEngine.voltage}V`);
            
            // ステータス表示
            if (status) {
                status.textContent = `Re GATE ${ver.Pro} - 準備完了`;
            }

            console.log(`${ver.Pro} Physics Engine auto-started`);
            console.log('HDL Output: Verilog/VHDL support enabled');
            console.log('Physics simulation running continuously');
        });
