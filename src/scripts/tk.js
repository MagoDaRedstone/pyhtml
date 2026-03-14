window.runTkinter = function(code) {
    setStatus('convertendo tkinter -> DOM...');
    runBtn.disabled = true;
    consoleEl.textContent = '';
    var existing = document.getElementById('tkframe');
    if (existing) existing.remove();
    var iframe = document.createElement('iframe');
    iframe.id = 'tkframe';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '1px solid rgba(255,255,255,0.06)';
    iframe.style.borderRadius = '8px';
    iframe.style.background = '#fff';
    iframe.setAttribute('title', 'tkinter preview');
    consoleEl.appendChild(iframe);

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:0;padding:12px;background:#0b1220;color:#e6eef8} .tk-btn{background:#10b981;color:#042018;border:none;padding:8px 10px;border-radius:6px;margin:6px 0;cursor:pointer} .tk-label{display:block;margin:6px 0} .tk-entry{display:block;margin:6px 0;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);width:100%;box-sizing:border-box} .tk-console{background:#02040a;color:#dbeafe;padding:8px;border-radius:6px;margin-top:8px;max-height:90px;overflow:auto;font-family:monospace;font-size:12px}</style></head><body></body></html>');
    doc.close();
    var styleTag = doc.createElement('style');
    styleTag.textContent = 'body{margin:0;padding:6px} .tk-root{background:#d9d9d9;color:#000;padding:8px;border-radius:4px} .tk-titlebar{background:#e6e6e6;color:#000;padding:8px 10px;border-radius:4px 4px 0 0;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:8px} .tk-frame{background:#d9d9d9;border:1px solid #a0a0a0;padding:6px;margin:6px 0;border-radius:4px;display:flex;flex-direction:column;gap:6px} .tk-frame.hbox{flex-direction:row} .tk-label{color:#000;padding:2px 4px} .tk-entry{background:#fff;border:1px solid #9a9a9a;padding:4px 6px;border-radius:2px;min-height:28px;box-sizing:border-box;width:100%} .tk-btn{background:#f0f0f0;color:#000;border:1px solid #9a9a9a;padding:6px 8px;border-radius:3px;margin:4px 0;cursor:pointer;min-height:28px} .tk-check,.tk-radio{display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer} .tk-console{background:#02040a;color:#dbeafe;padding:8px;border-radius:6px;margin-top:8px;max-height:90px;overflow:auto;font-family:monospace;font-size:12px}';
    doc.head.appendChild(styleTag);

    class ParserElements {
        constructor() {
            this.elementDefs = [];
            this.rootName = null;
            this.titleMap = {};
            this.sideMap = {};
            this.funcs = {};
            this.currentLine = '';
        }

        parseTk() {
            var equalIndex = this.currentLine.indexOf('=');
            var tkIndex = this.currentLine.indexOf('Tk()');
            if (equalIndex > -1 && tkIndex > -1) {
                this.rootName = this.currentLine.substring(0, equalIndex).trim();
            }
        }

        parseTitle() {
            var dotIndex = this.currentLine.indexOf('.title(');
            if (dotIndex > -1) {
                var varName = this.currentLine.substring(0, dotIndex).trim();
                var openParen = this.currentLine.indexOf('(', dotIndex);
                var firstQuote = this.currentLine.indexOf('"', openParen);
                if (firstQuote === -1) firstQuote = this.currentLine.indexOf("'", openParen);
                if (firstQuote > -1) {
                    var secondQuote = this.currentLine.indexOf(this.currentLine[firstQuote], firstQuote + 1);
                    if (secondQuote > -1) {
                        this.titleMap[varName] = this.currentLine.substring(firstQuote + 1, secondQuote);
                    }
                }
            }
        }

        parseLabel() {
            var labelIndex = this.currentLine.indexOf('Label(');
            if (labelIndex > -1) {
                var beforeLabel = this.currentLine.substring(0, labelIndex);
                var equalIndex = beforeLabel.indexOf('=');
                var varName = equalIndex > -1 ? beforeLabel.substring(0, equalIndex).trim() : null;
                var openParen = this.currentLine.indexOf('(', labelIndex);
                var closeParen = this.currentLine.lastIndexOf(')');
                if (closeParen > -1) {
                    var args = this.currentLine.substring(openParen + 1, closeParen);
                    var textValue = '';
                    var textMatch = args.match(/text\s*=\s*f?["'](.*?)["']/);
                    if (textMatch) textValue = textMatch[1];
                    this.elementDefs.push({ type: 'label', text: textValue, varName: varName, args: args });
                }
            }
        }

        parseEntry() {
            var entryIndex = this.currentLine.indexOf('Entry(');
            if (entryIndex > -1) {
                var beforeEntry = this.currentLine.substring(0, entryIndex);
                var equalIndex = beforeEntry.indexOf('=');
                if (equalIndex > -1) {
                    this.elementDefs.push({ type: 'entry', varName: beforeEntry.substring(0, equalIndex).trim(), text: '', args: '' });
                }
            }
        }

        parseButton() {
            var buttonIndex = this.currentLine.indexOf('Button(');
            if (buttonIndex > -1) {
                var beforeButton = this.currentLine.substring(0, buttonIndex);
                var equalIndex = beforeButton.indexOf('=');
                var varName = equalIndex > -1 ? beforeButton.substring(0, equalIndex).trim() : null;
                var openParen = this.currentLine.indexOf('(', buttonIndex);
                var closeParen = this.currentLine.lastIndexOf(')');
                if (closeParen > -1) {
                    var args = this.currentLine.substring(openParen + 1, closeParen);
                    var textMatch = args.match(/text\s*=\s*["'](.*?)["']/);
                    var cmdMatch = args.match(/command\s*=\s*([a-zA-Z_]\w*)/);
                    this.elementDefs.push({
                        type: 'button',
                        text: textMatch ? textMatch[1] : 'Button',
                        varName: varName,
                        command: cmdMatch ? cmdMatch[1] : null
                    });
                }
            }
        }

        parseFunction(line, nextLines, startIndex) {
            var funcDefIndex = line.indexOf('def ');
            if (funcDefIndex > -1 && line.includes('():')) {
                var funcName = line.substring(funcDefIndex + 4, line.indexOf('():')).trim();
                var funcBody = [];
                var j = startIndex + 1;
                var baseIndent = line.match(/^\s*/)[0].length;
                while (j < nextLines.length) {
                    if (nextLines[j].trim() !== '' && nextLines[j].match(/^\s*/)[0].length <= baseIndent) break;
                    funcBody.push(nextLines[j]);
                    j++;
                }
                this.funcs[funcName] = { body: funcBody.join('\n') };
                return j - 1;
            }
            return startIndex;
        }

        parsePack() {
            if (this.currentLine.includes('.pack(')) {
                var varName = this.currentLine.substring(0, this.currentLine.indexOf('.pack(')).trim();
                var sideMatch = this.currentLine.match(/side\s*=\s*["'](.*?)["']/);
                if (sideMatch) this.sideMap[varName] = sideMatch[1];
            }
        }
    }

    function parseElements(code) {
        var parser = new ParserElements();
        var lines = code.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            parser.currentLine = lines[i];
            if (line.includes('= Tk()')) parser.parseTk();
            else if (line.includes('.title(')) parser.parseTitle();
            else if (line.includes('Label(')) parser.parseLabel();
            else if (line.includes('Entry(')) parser.parseEntry();
            else if (line.includes('Button(')) parser.parseButton();
            else if (line.includes('.pack(')) parser.parsePack();
            else if (line.startsWith('def ')) i = parser.parseFunction(lines[i], lines, i);
        }
        return { elements: parser.elementDefs, funcs: parser.funcs, sideMap: parser.sideMap, rootName: parser.rootName, titleMap: parser.titleMap };
    }

    function renderTk(parsed) {
        var body = doc.body;
        var rootDiv = doc.createElement('div');
        rootDiv.className = 'tk-root';
        body.appendChild(rootDiv);

        var titleText = parsed.titleMap[parsed.rootName] || Object.values(parsed.titleMap)[0] || '';
        if (titleText) {
            var titleBar = doc.createElement('div');
            titleBar.className = 'tk-titlebar';
            titleBar.textContent = titleText;
            rootDiv.appendChild(titleBar);
        }

        var miniConsole = doc.createElement('div');
        miniConsole.className = 'tk-console';
        miniConsole.textContent = '[mini-console]';
        rootDiv.appendChild(miniConsole);

        function miniLog(t) {
            var n = doc.createElement('div');
            n.textContent = t;
            miniConsole.appendChild(n);
            miniConsole.scrollTop = miniConsole.scrollHeight;
        }

        var labelMap = {}, entryMap = {};

parsed.elements.forEach(function(def) {
            if (def.type === 'label') {
                var el = doc.createElement('div');
                el.className = 'tk-label';
                el.textContent = def.text;
                rootDiv.appendChild(el);
                if (def.varName) labelMap[def.varName] = el;
            } else if (def.type === 'entry') {
                var input = doc.createElement('input');
                input.className = 'tk-entry';
                rootDiv.appendChild(input);
                if (def.varName) entryMap[def.varName] = input;
            } else if (def.type === 'button') {
                var btn = doc.createElement('button');
                btn.className = 'tk-btn';
                btn.textContent = def.text;
                btn.addEventListener('click', function() {
                    if (def.command && parsed.funcs[def.command]) {

                        function executarBloco(corpo) {
                            var localVars = {};
                            for (var name in entryMap) {
                                localVars[name] = entryMap[name].value;
                            }

                            var lines = corpo.split('\n');
                            var emErro = false;

                            for (var i = 0; i < lines.length; i++) {
                                var l = lines[i].trim();
                                if (!l || l.startsWith('#')) continue;

                                if (l.startsWith('except:') && !emErro) {
                                    break;
                                }
                                if (l.startsWith('except:') && emErro) {
                                    continue;
                                }

                                try {
                                    var funcCall = l.match(/^(\w+)\(\)$/);
                                    if (funcCall && parsed.funcs[funcCall[1]]) {
                                        executarBloco(parsed.funcs[funcCall[1]].body);
                                        continue;
                                    }

                                    var printMatch = l.match(/print\(f?["'](.*?)["']\)/);
                                    if (printMatch) {
                                        var template = printMatch[1];
                                        var result = template.replace(/\{(.*?)\}/g, (match, expr) => {
                                            var entryVar = expr.replace('.get()', '').trim();
                                            if (entryMap[entryVar]) return entryMap[entryVar].value;

                                            var keys = Object.keys(localVars);
                                            var vals = Object.values(localVars);
                                            try {
                                                return new Function(...keys, `return ${expr}`)(...vals);
                                            } catch(e) { return match; }
                                        });

                                        miniLog(result);

                                        continue;
                                    }

                                    var clearMatch = l.match(/limpar\(["'](\w+)["']\)/);
                                    if (clearMatch) {
                                        var target = clearMatch[1];
                                        if (labelMap[target]) labelMap[target].textContent = '';
                                        if (entryMap[target]) entryMap[target].value = '';

                                        miniConsole.textContent = '[mini-console]';
                                        continue;
                                    }

                                    var m = l.match(/(\w+)\s*=\s*(?:float|int)\((\w+)\.get\(\)\)/);
                                    if (m) {
                                        var val = localVars[m[2]];
                                        if (val.trim() === "" || isNaN(parseFloat(val))) throw new Error();
                                        localVars[m[1]] = parseFloat(val);
                                        continue;
                                    }

                                    var configMatch = l.match(/(\w+)\.config\(text\s*=\s*f?["'](.*?)["']\)/);
                                    if (configMatch) {
                                        var targetLabel = configMatch[1];
                                        var template = configMatch[2];
                                        var result = template.replace(/\{(.*?)\}/g, (match, expr) => {
                                            var keys = Object.keys(localVars);
                                            var vals = Object.values(localVars);
                                            return new Function(...keys, `return ${expr}`)(...vals);
                                        });
                                        if (labelMap[targetLabel]) labelMap[targetLabel].textContent = result;
                                        if (!emErro) miniLog(result);
                                        continue;
                                    }
                                } catch (e) {
                                    emErro = true;
                                    while (i < lines.length && !lines[i].trim().startsWith('except:')) {
                                        i++;
                                    }
                                    i--;
                                }
                            }
                        }

                        executarBloco(parsed.funcs[def.command].body);
                    }
                });
                rootDiv.appendChild(btn);
            }
        });

        setStatus('pronto');
        runBtn.disabled = false;
    }

    try {
        renderTk(parseElements(code));
    } catch (e) {
        errf(String(e));
        setStatus('pronto');
        runBtn.disabled = false;
    }
};
