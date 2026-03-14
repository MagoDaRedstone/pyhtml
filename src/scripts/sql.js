window.runSql = function(code) {
    setStatus('executando sql...');
    runBtn.disabled = true;
    consoleEl.textContent = '';
    code = code.replace(/\u00A0/g, ' ');
    var lines = code.split(/\r?\n/).filter(l => !/^\s*(import|from)\s+sql\b/.test(l));
    code = lines.join('\n');

    var out = document.createElement('div');
    out.style.fontFamily = 'monospace';
    out.style.whiteSpace = 'pre';
    consoleEl.appendChild(out);

    function log(t) {
        out.textContent += t + '\n';
    }

    try {
        var db = {};
        var lines = code.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        function parseWhere(where, table) {
            if (!where) return () => true;
            var m = where.match(/^(\w+)\s*=\s*["']?(.+?)["']?$/);
            if (!m) throw 'WHERE inválido';
            var col = m[1];
            var val = m[2];
            var idx = table.cols.indexOf(col);
            if (idx === -1) throw 'Coluna inválida no WHERE: ' + col;
            return row => String(row[idx]) === val;
        }

        lines.forEach(function(line) {
            var m = line.match(/^create\s+table\s+(\w+)\s*\((.+)\)$/i);
            if (m) {
                var table = m[1];
                var colString = m[2];
                var colParts = colString.split(',').map(c => c.trim());
                for (var i = 0; i < colParts.length; i++) {
                    if (colParts[i].split(/\s+/).length > 1) {
                        var words = colParts[i].split(/\s+/);
                        var problemCol = words[0];
                        var pointer = "";
                        for (var j = 0; j < i; j++) {
                            pointer += colParts[j] + ", ";
                        }
                        pointer += problemCol;
                        throw "vc esqueceu dele ,\ncreate table " + table + " (" + pointer + " <---- vc esqueceu da virgula aqui!!";
                    }
                }

                var cols = colString.split(',').map(c => c.trim().split(/\s+/)[0]);
                db[table] = {
                    cols: cols,
                    rows: []
                };
                return;
            }

            m = line.match(/^insert\s+into\s+(\w+)\s+values\s*\((.+)\)$/i);
            if (m) {
                var table = m[1];
                if (!db[table]) throw 'Tabela não existe: ' + table;

                var valuesStr = m[2];
                var vals;

                if (valuesStr.includes(',')) {
                    vals = valuesStr.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                } else {
                    vals = [];
                    var current = '';
                    var inQuotes = false;

                    for (var i = 0; i < valuesStr.length; i++) {
                        var char = valuesStr[i];

                        if (char === '"' || char === "'") {
                            inQuotes = !inQuotes;
                            current += char;
                        } else if (char === ' ' && !inQuotes) {
                            if (current.trim()) {
                                vals.push(current.trim().replace(/^["']|["']$/g, ''));
                                current = '';
                            }
                        } else {
                            current += char;
                        }
                    }

                    if (current.trim()) {
                        vals.push(current.trim().replace(/^["']|["']$/g, ''));
                    }
                }

                db[table].rows.push(vals);
                return;
            }

            m = line.match(/^select\s+(.+)\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i);
            if (m) {
                var colsPart = m[1].trim();
                var table = m[2];
                var where = m[3];
                if (!db[table]) throw 'Tabela não existe: ' + table;

                var tableObj = db[table];
                var filter = parseWhere(where, tableObj);
                var cols, idxs;

                if (colsPart === '*') {
                    cols = tableObj.cols;
                    idxs = cols.map((_, i) => i);
                } else {
                    cols = colsPart.split(',').map(c => c.trim());
                    idxs = cols.map(c => {
                        var i = tableObj.cols.indexOf(c);
                        if (i === -1) throw 'Coluna inválida: ' + c;
                        return i;
                    });
                }

                log(cols.join(' | '));
                log('-'.repeat(cols.join(' | ').length));
                tableObj.rows.filter(filter).forEach(r => {
                    log(idxs.map(i => r[i]).join(' | '));
                });
                log('');
                return;
            }

            m = line.match(/^update\s+(\w+)\s+set\s+(\w+)\s*=\s*["']?(.+?)["']?(?:\s+where\s+(.+))?$/i);
            if (m) {
                var table = m[1];
                var col = m[2];
                var val = m[3];
                var where = m[4];
                if (!db[table]) throw 'Tabela não existe: ' + table;

                var tableObj = db[table];
                var idx = tableObj.cols.indexOf(col);
                if (idx === -1) throw 'Coluna inválida: ' + col;

                var filter = parseWhere(where, tableObj);
                tableObj.rows.forEach(r => {
                    if (filter(r)) r[idx] = val;
                });
                return;
            }

            m = line.match(/^delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i);
            if (m) {
                var table = m[1];
                var where = m[2];
                if (!db[table]) throw 'Tabela não existe: ' + table;

                var tableObj = db[table];
                var filter = parseWhere(where, tableObj);
                tableObj.rows = tableObj.rows.filter(r => !filter(r));
                return;
            }

            m = line.match(/^drop\s+table\s+(\w+)$/i);
            if (m) {
                delete db[m[1]];
                return;
            }

            if (line.length > 0) {
                throw 'SQL inválido: ' + line;
            }
        });

        setStatus('pronto');
        runBtn.disabled = false;
    } catch (e) {
        errf(String(e));
        setStatus('pronto');
        runBtn.disabled = false;
    }
};
