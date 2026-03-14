var editor = document.getElementById('editor');
var runBtn = document.getElementById('run');
var clearBtn = document.getElementById('clear');
var statusEl = document.getElementById('status');
var consoleEl = document.getElementById('console');

function appendConsole(text, kind) {
    kind = kind || 'out';
    var prefix = kind === 'err' ? 'ERR: ' : '';
    var node = document.createElement('div');
    node.textContent = prefix + text;
    node.style.whiteSpace = 'pre-wrap';
    if (kind === 'err') node.style.color = '#ff9b9b';
    consoleEl.appendChild(node);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setStatus(s) {
    statusEl.textContent = s;
}

function outf(text) {
    appendConsole(text, 'out');
}

function errf(text) {
    appendConsole(text, 'err');
}

function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
        throw "File not found: '" + x + "'";
    return Sk.builtinFiles["files"][x];
}

function inputFun(prompt) {
    return new Promise(function(resolve) {
        if (prompt) appendConsole(prompt, 'out');

        var input = document.createElement('input');
        input.type = 'text';
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.margin = '4px 0';

        consoleEl.appendChild(input);
        input.focus();

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var value = input.value;
                consoleEl.removeChild(input);
                appendConsole(value, 'out');
                resolve(value);
            }
        });
    });
}

function runCode() {
    var code = editor.innerText.replace(/\u00A0/g, ' ');

    if (/\bimport\s+sql\b/.test(code) || /\bfrom\s+sql\b/.test(code)) {
        try {
            runSql(code);
        } catch (e) {
            errf(String(e));
            setStatus('pronto');
            runBtn.disabled = false;
        }
        return;
    }

    if (/\bimport\s+tkinter\b/.test(code) || /\bfrom\s+tkinter\b/.test(code)) {
        try {
            runTkinter(code);
        } catch (e) {
            errf(String(e));
            setStatus('pronto');
            runBtn.disabled = false;
        }
        return;
    }

    setStatus('executando...');
    runBtn.disabled = true;

    Sk.configure({
        output: outf,
        read: builtinRead,
        inputfun: inputFun,
        inputfunTakesPrompt: true
    });

    var promise;
    try {
        promise = Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, code, true);
        });
    } catch (e) {
        errf(String(e));
        setStatus('pronto');
        runBtn.disabled = false;
        return;
    }

    promise.then(function() {
        setStatus('pronto');
        runBtn.disabled = false;
    }, function(err) {
        errf(err.toString());
        setStatus('pronto');
        runBtn.disabled = false;
    });
}

editor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        var sel = window.getSelection();
        var range = sel.getRangeAt(0);
        var tabNode = document.createTextNode('    ');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }
    if ((e.key === 'Enter' || e.key === '⏎') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runCode();
    }
});

runBtn.addEventListener('click', runCode);
clearBtn.addEventListener('click', function() {
    consoleEl.textContent = '';
    appendConsole('output');
});

setStatus('Python (Skulpt) pronto');

document.getElementById('docs').addEventListener('click', function() {
  window.open('doc.html');
});

var examplesBtn = document.getElementById('examples');
var examplesPanel = document.getElementById('examples-panel');

var examples = {
  sql: `import sql

create table alunos (id, nome, nota)
insert into alunos values (1, "João", 8.5)
insert into alunos values (2, "Maria", 9.0)
insert into alunos values (3, "Pedro", 7.5)

select * from alunos
select * from alunos where nome = "Maria"`,

  tkinter: `from tkinter import *

root = Tk()
root.title("Calculadora Simples")

lbl1 = Label(text="Valor 1:")
lbl1.pack()
v1 = Entry()
v1.pack()

lbl2 = Label(text="Valor 2:")
lbl2.pack()
v2 = Entry()
v2.pack()

resultado = Label(text="Resultado: ")
resultado.pack()

def apagar():
    limpar("resultado")

def somar():
    try:
        apagar()
        n1 = float(v1.get())
        n2 = float(v2.get())
        resultado.config(text=f"Resultado: {n1} + {n2} = {n1 + n2}")
    except:
        resultado.config(text="Erro: digite números válidos!")

def subtrair():
    try:
        apagar()
        n1 = float(v1.get())
        n2 = float(v2.get())
        resultado.config(text=f"Resultado: {n1} - {n2} = {n1 - n2}")
    except:
        resultado.config(text="Erro: digite números válidos!")

btn_soma = Button(text="Somar", command=somar)
btn_soma.pack()

btn_sub = Button(text="Subtrair", command=subtrair)
btn_sub.pack()

root.mainloop()`
};

examplesBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  examplesPanel.classList.toggle('hidden');

  var btnRect = examplesBtn.getBoundingClientRect();
  examplesPanel.style.top = (btnRect.bottom + window.scrollY) + 'px';
  examplesPanel.style.left = btnRect.left + 'px';
});

document.addEventListener('click', function(e) {
  if (!examplesPanel.contains(e.target) && e.target !== examplesBtn) {
    examplesPanel.classList.add('hidden');
  }
});

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    var exampleKey = this.dataset.example;
    var exampleCode = examples[exampleKey];

    if (exampleCode) {
      editor.innerText = exampleCode;
      examplesPanel.classList.add('hidden');
    }
  });
});
