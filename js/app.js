// SplitPop (browser-only). Everything is saved in this browser's localStorage.
(function () {
    'use strict';

    const L = window.SplitLogic;
    const CREATURES = ['👾', '🤖', '👽', '🦖', '🐙', '🦑', '🧌', '🐸', '🦝', '🐊'];
    const COLORS = ['#c6ff3d', '#3de0ff', '#ffe14d', '#ff8a5c', '#b79bff', '#7dffb2', '#ff7aa8', '#9fb4ff'];
    const KEY = 'splitpop.v1';
    const app = document.getElementById('app');

    // ---------- storage ----------
    let db = load();
    let notice = '';
    let memoryOnly = false;

    function load() {
        try {
            const d = JSON.parse(localStorage.getItem(KEY));
            if (d && Array.isArray(d.pops)) return d;
        } catch (e) { /* first visit or storage blocked */ }
        return { pops: [] };
    }

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(db));
            memoryOnly = false;
        } catch (e) {
            memoryOnly = true; // private window / storage blocked: works until the tab closes
        }
    }

    // ---------- helpers ----------
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

    function today() {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 10);
    }

    function fmtDate(s) {
        if (!s) return '';
        const d = new Date(s + 'T00:00:00');
        return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function toB64(obj) {
        const json = JSON.stringify(obj);
        return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function fromB64(s) {
        let b = s.replace(/-/g, '+').replace(/_/g, '/');
        while (b.length % 4) b += '=';
        return JSON.parse(decodeURIComponent(escape(atob(b))));
    }

    const currentPop = () => {
        const m = location.hash.match(/^#\/p\/([\w-]+)$/);
        return m ? db.pops.find((p) => p.id === m[1]) : null;
    };

    // ---------- views ----------
    function homeView() {
        const pops = db.pops.map((p) => `
            <a class="poplink" href="#/p/${esc(p.id)}">
                <span class="big-emoji sm">${esc(p.emoji)}</span>
                <span>${esc(p.name)}<br><small>${p.members.length} friends · ${p.expenses.length} bill${p.expenses.length === 1 ? '' : 's'}</small></span>
            </a>`).join('');

        return `
        <section class="hero">
            <h1>Split the bill.<br><span class="hl">Skip the drama.</span></h1>
            <p class="lead">Type the amount, say who paid, and SplitPop does the maths nobody wants to do. No sign-up. No server.</p>
        </section>

        <div class="home-grid">
            <form class="card lav" data-form="create" novalidate>
                <h2>Start a pop ⚡</h2>

                <label class="lbl" for="name">What's the occasion?</label>
                <input class="field" id="name" name="name" maxlength="60" placeholder="Goa trip, Flat 4B, Pizza night…" required>

                <span class="lbl">Pick a vibe</span>
                <div class="chips">
                    ${L.VIBES.map((v, i) => `<label class="chip"><input type="radio" name="emoji" value="${v}" ${i === 0 ? 'checked' : ''}><span>${v}</span></label>`).join('')}
                </div>

                <span class="lbl">Currency</span>
                <div class="chips">
                    ${L.CURRENCIES.map((c, i) => `<label class="chip"><input type="radio" name="currency" value="${c}" ${i === 0 ? 'checked' : ''}><span>${c}</span></label>`).join('')}
                </div>

                <span class="lbl">Who's in? <span class="opt">(at least 2, you can add more later)</span></span>
                <div class="friends" data-friends>
                    <input class="field" type="text" name="members" maxlength="40" placeholder="Friend's name">
                    <input class="field" type="text" name="members" maxlength="40" placeholder="Friend's name">
                    <input class="field" type="text" name="members" maxlength="40" placeholder="Friend's name">
                </div>
                <button type="button" class="btn ghost" data-action="add-friend-input">+ another friend</button>

                <p class="left" data-err hidden></p>
                <button type="submit" class="btn pink big">Make it pop 💥</button>
            </form>

            <div class="how">
                ${pops ? `<div class="card yellow"><h2>Your pops 📚</h2>${pops}</div>` : ''}
                <div class="card mint sticker s2">
                    <span class="num">1</span>
                    <h3>Make a pop</h3>
                    <p>Name it, add your friends. Ten seconds.</p>
                </div>
                <div class="card sky sticker s3">
                    <span class="num">2</span>
                    <h3>Dump the bills</h3>
                    <p>Type the amount and who paid. Split equally or by exact amounts.</p>
                </div>
                <div class="card pink sticker s4">
                    <span class="num">3</span>
                    <h3>Settle up</h3>
                    <p>We find the fewest payments so everyone's even. 🤝</p>
                </div>
                <div class="card sticker s1">
                    <span class="num">4</span>
                    <h3>Heads up</h3>
                    <p>Your pops live in <b>this browser only</b>. Use "Share a copy" to send a friend a snapshot.</p>
                </div>
            </div>
        </div>`;
    }

    function popView(p) {
        const sym = p.currency;
        const fmt = (c) => L.fmt(c, sym);
        const ids = p.members.map((m) => m.id);
        const nameOf = (id) => { const m = p.members.find((x) => x.id === id); return m ? esc(m.name) : '?'; };
        const lookOf = (id) => {
            const i = Math.max(0, ids.indexOf(id));
            return { emoji: CREATURES[i % CREATURES.length], color: COLORS[i % COLORS.length] };
        };

        const res = L.compute(
            ids,
            p.expenses.map((e) => ({ paidBy: e.paidBy, amount: e.cents, shares: e.shares })),
            p.settlements.map((s) => ({ from: s.from, to: s.to, amount: s.cents })),
        );
        const total = p.expenses.reduce((a, e) => a + e.cents, 0);
        const expenses = [...p.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const avatar = (id) => `<span class="avatar" style="--c:${lookOf(id).color}">${lookOf(id).emoji}</span>`;

        const expenseCards = expenses.length ? expenses.map((e) => `
            <article class="card exp">
                <div class="thumb none">🧾</div>
                <div class="exp-body">
                    <h3>${esc(e.title)}</h3>
                    <p class="meta">${lookOf(e.paidBy).emoji} <b>${nameOf(e.paidBy)}</b> paid${e.date ? ' · ' + esc(fmtDate(e.date)) : ''}</p>
                    <div class="pills">
                        ${Object.keys(e.shares).map((m) => `<span class="pill" style="--c:${lookOf(m).color}">${nameOf(m)} ${esc(fmt(e.shares[m]))}</span>`).join('')}
                    </div>
                </div>
                <div class="exp-side">
                    <div class="amt">${esc(fmt(e.cents))}</div>
                    <button type="button" class="link" data-action="del-expense" data-id="${esc(e.id)}">🗑️ delete</button>
                </div>
            </article>`).join('') : `
            <div class="card empty"><span class="big-emoji">👀</span><p>No bills yet. Suspiciously responsible group.</p></div>`;

        const balances = p.members.map((m) => {
            const n = res.net[m.id] || 0;
            const tag = n > 0 ? `<span class="tag good">gets back ${esc(fmt(n))}</span>`
                : n < 0 ? `<span class="tag bad">owes ${esc(fmt(-n))}</span>`
                    : '<span class="tag">all square ✨</span>';
            return `<div class="bal">${avatar(m.id)}<b>${esc(m.name)}</b>${tag}</div>`;
        }).join('');

        const transfers = res.transfers.length ? res.transfers.map((t) => `
            <div class="xfer">
                <div><b>${nameOf(t.from)}</b> → <b>${nameOf(t.to)}</b><div class="amt sm">${esc(fmt(t.amount))}</div></div>
                <button type="button" class="btn small" data-action="settle" data-from="${esc(t.from)}" data-to="${esc(t.to)}" data-cents="${t.amount}">Paid ✅</button>
            </div>`).join('') : '<p class="happy">Nobody owes anybody. Weird. Enjoy it. ☮️</p>';

        const history = p.settlements.length ? `
            <details class="hist">
                <summary>Already settled (${p.settlements.length})</summary>
                ${[...p.settlements].reverse().map((s) => `
                    <div class="xfer small">
                        <span>${nameOf(s.from)} paid ${nameOf(s.to)} ${esc(fmt(s.cents))}</span>
                        <button type="button" class="link" data-action="unsettle" data-id="${esc(s.id)}">undo</button>
                    </div>`).join('')}
            </details>` : '';

        return `
        <section class="card yellow banner">
            <div>
                <span class="big-emoji">${esc(p.emoji)}</span>
                <h1>${esc(p.name)}</h1>
                <p class="meta">${p.members.length} friends · ${p.expenses.length} bill${p.expenses.length === 1 ? '' : 's'} · ${esc(fmt(total))} spent</p>
            </div>
            <div class="share">
                <p><b>Send a friend a copy 👇</b></p>
                <div class="linkbox">
                    <button type="button" class="btn" data-action="copy-link">Share a copy</button>
                    <button type="button" class="btn ghost" data-action="delete-pop">Delete pop</button>
                </div>
                <p class="mini">The link holds a snapshot of this pop. Changes after you share won't sync, because there's no server.</p>
            </div>
        </section>

        <div class="cols">
            <div class="col-main">
                <form class="card mint" data-form="expense" novalidate>
                    <h2>Add a bill 🧾</h2>

                    <div class="row2">
                        <div>
                            <label class="lbl" for="title">What was it?</label>
                            <input class="field" id="title" name="title" maxlength="80" placeholder="Pizza, cab, chai…">
                        </div>
                        <div>
                            <label class="lbl" for="amount">Amount (${esc(sym)})</label>
                            <input class="field" id="amount" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="0.00" data-amount>
                        </div>
                    </div>

                    <div class="row2">
                        <div>
                            <label class="lbl" for="paid_by">Who paid?</label>
                            <select class="field" id="paid_by" name="paid_by">
                                ${p.members.map((m) => `<option value="${esc(m.id)}">${lookOf(m.id).emoji} ${esc(m.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="lbl" for="spent_on">When?</label>
                            <input class="field" id="spent_on" name="spent_on" type="date" value="${today()}">
                        </div>
                    </div>

                    <span class="lbl">How to split?</span>
                    <div class="chips">
                        <label class="chip wide"><input type="radio" name="split_mode" value="equal" checked><span>🍰 Equally</span></label>
                        <label class="chip wide"><input type="radio" name="split_mode" value="custom"><span>🎯 Custom amounts</span></label>
                    </div>

                    <div class="people" data-mode="equal">
                        ${p.members.map((m) => `
                            <label class="person">
                                <input type="checkbox" name="split_with" value="${esc(m.id)}" checked>
                                ${avatar(m.id)}<b>${esc(m.name)}</b>
                            </label>`).join('')}
                    </div>

                    <div class="people" data-mode="custom" hidden>
                        ${p.members.map((m) => `
                            <label class="person">
                                ${avatar(m.id)}<b>${esc(m.name)}</b>
                                <input class="field tiny" type="number" step="0.01" min="0" inputmode="decimal" name="custom_${esc(m.id)}" placeholder="0" data-custom>
                            </label>`).join('')}
                        <p class="left" data-left></p>
                    </div>

                    <p class="left" data-err hidden></p>
                    <button type="submit" class="btn pink big">Add it 🎉</button>
                </form>

                <h2 class="sec">The receipts 🧾</h2>
                ${expenseCards}
            </div>

            <aside class="col-side">
                <section class="card sky"><h2>Who's where 💸</h2>${balances}</section>
                <section class="card orange"><h2>Settle up 🤝</h2>${transfers}${history}</section>
                <section class="card pink">
                    <h2>New to the crew? 👋</h2>
                    <form class="addfriend" data-form="member" novalidate>
                        <input class="field" name="name" maxlength="40" placeholder="Friend's name">
                        <button type="submit" class="btn small">Add</button>
                        <p class="left" data-err hidden></p>
                    </form>
                    <p class="mini">New friends only share bills you add from now on.</p>
                </section>
            </aside>
        </div>`;
    }

    // ---------- render + routing ----------
    function render(html) {
        const banner = [
            memoryOnly ? '<div class="card oops" role="alert"><strong>Heads up 🛑</strong><br>Your browser is blocking storage, so this pop will vanish when you close the tab.</div>' : '',
            notice ? `<div class="toast" role="status">${esc(notice)}</div>` : '',
        ].join('');
        notice = '';
        app.innerHTML = banner + html;
        syncMode();
        updateLeft();
        window.scrollTo(0, 0);
    }

    function route() {
        const hash = location.hash;
        let m = hash.match(/^#\/s\/(.+)$/);
        if (m) return importShared(m[1]);

        m = hash.match(/^#\/p\/([\w-]+)$/);
        if (m) {
            const p = db.pops.find((x) => x.id === m[1]);
            if (p) return render(popView(p));
            notice = "That pop isn't saved in this browser. Ask your friend for a share link 🔗";
            history.replaceState(null, '', '#/');
        }
        render(homeView());
    }

    function importShared(data) {
        let pop = null;
        try { pop = L.clean(fromB64(data), uid); } catch (e) { /* bad link */ }
        if (!pop) {
            notice = "That share link looks broken, so I couldn't open it 😵";
            history.replaceState(null, '', '#/');
            return render(homeView());
        }
        db.pops.unshift(pop);
        save();
        notice = 'Opened a copy of "' + pop.name + '" shared with you 🎉';
        history.replaceState(null, '', '#/p/' + pop.id); // replace, so a refresh doesn't import it twice
        render(popView(pop));
    }

    // ---------- form handling ----------
    function showErr(form, msg) {
        const el = form.querySelector('[data-err]');
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    function createPop(form) {
        const f = new FormData(form);
        const name = String(f.get('name') || '').trim().slice(0, 60);
        if (!name) return showErr(form, 'Give your pop a name 🏷️');

        const seen = new Set();
        const members = [];
        f.getAll('members').forEach((raw) => {
            const n = String(raw).trim().slice(0, 40);
            if (n && !seen.has(n.toLowerCase()) && members.length < 20) {
                seen.add(n.toLowerCase());
                members.push({ id: uid(), name: n });
            }
        });
        if (members.length < 2) return showErr(form, 'A pop needs at least 2 different friends to split with 👯');

        const emoji = L.VIBES.includes(f.get('emoji')) ? f.get('emoji') : L.VIBES[0];
        const currency = L.CURRENCIES.includes(f.get('currency')) ? f.get('currency') : '₹';
        const pop = { id: uid(), name, emoji, currency, members, expenses: [], settlements: [] };
        db.pops.unshift(pop);
        save();
        notice = 'Your pop is live! Add some bills 🎈';
        location.hash = '#/p/' + pop.id;
    }

    function addExpense(form, p) {
        const f = new FormData(form);
        const cents = L.toCents(f.get('amount'));
        if (cents <= 0) return showErr(form, 'Type an amount bigger than zero 💸');
        if (cents > 1e11) return showErr(form, 'That amount is too big 🙈');

        const paidBy = String(f.get('paid_by'));
        if (!p.members.some((m) => m.id === paidBy)) return showErr(form, 'Pick who paid 🙋');

        let shares = {};
        if (f.get('split_mode') === 'equal') {
            const ids = f.getAll('split_with').map(String).filter((id) => p.members.some((m) => m.id === id));
            if (!ids.length) return showErr(form, 'Pick at least one person to split with 🍰');
            shares = L.splitEqual(cents, ids);
        } else {
            let sum = 0;
            p.members.forEach((m) => {
                const c = L.toCents(f.get('custom_' + m.id));
                if (c > 0) { shares[m.id] = c; sum += c; }
            });
            if (!sum) return showErr(form, 'Type an amount next to at least one person 🎯');
            if (sum !== cents) {
                return showErr(form, 'The custom amounts add up to ' + L.fmt(sum, p.currency) +
                    ' but the bill is ' + L.fmt(cents, p.currency) + '. Close the gap! 🧮');
            }
        }

        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(f.get('spent_on'))) ? String(f.get('spent_on')) : today();
        p.expenses.unshift({
            id: uid(),
            title: String(f.get('title') || '').trim().slice(0, 80) || 'Mystery spend',
            cents,
            paidBy,
            date,
            shares,
        });
        save();
        notice = 'Bill added. Receipts +1 🧾';
        render(popView(p));
    }

    function addMember(form, p) {
        const name = String(new FormData(form).get('name') || '').trim().slice(0, 40);
        if (!name) return showErr(form, 'Type a name first 🙂');
        if (p.members.length >= 20) return showErr(form, 'This pop is full (20 friends max) 🎈');
        if (p.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return showErr(form, name + ' is already in this pop!');
        p.members.push({ id: uid(), name });
        save();
        notice = name + ' joined the pop 🎉';
        render(popView(p));
    }

    // ---------- live helpers ----------
    function syncMode() {
        const checked = app.querySelector('input[name="split_mode"]:checked');
        if (!checked) return;
        app.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = el.dataset.mode !== checked.value; });
    }

    function updateLeft() {
        const left = app.querySelector('[data-left]');
        const amount = app.querySelector('[data-amount]');
        if (!left || !amount) return;
        let sum = 0;
        app.querySelectorAll('[data-custom]').forEach((i) => { sum += L.toCents(i.value); });
        const diff = L.toCents(amount.value) - sum;
        left.classList.toggle('ok', diff === 0 && sum > 0);
        if (sum === 0) left.textContent = 'Type what each person owes 🎯';
        else if (diff === 0) left.textContent = 'Perfect, all assigned ✅';
        else if (diff > 0) left.textContent = (diff / 100).toFixed(2) + ' still to assign';
        else left.textContent = (Math.abs(diff) / 100).toFixed(2) + ' too much!';
    }

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            window.prompt('Copy this link:', text);
            return false;
        }
    }

    // ---------- events (delegated, so re-rendering is safe) ----------
    app.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-form]');
        if (!form) return;
        e.preventDefault();
        const kind = form.dataset.form;
        if (kind === 'create') return createPop(form);
        const p = currentPop();
        if (!p) return;
        if (kind === 'expense') addExpense(form, p);
        else if (kind === 'member') addMember(form, p);
    });

    app.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.dataset.action;

        if (action === 'add-friend-input') {
            const box = app.querySelector('[data-friends]');
            if (box && box.children.length < 20) {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = 'members';
                input.maxLength = 40;
                input.placeholder = "Friend's name";
                input.className = 'field';
                box.appendChild(input);
                input.focus();
            }
            return;
        }

        const p = currentPop();
        if (!p) return;

        if (action === 'copy-link') {
            const url = location.href.split('#')[0] + '#/s/' + toB64(p);
            const ok = await copy(url);
            el.textContent = ok ? 'Copied! 🎉' : 'Share a copy';
            if (ok) setTimeout(() => { el.textContent = 'Share a copy'; }, 1600);
        } else if (action === 'delete-pop') {
            if (confirm('Delete "' + p.name + '" and all its bills from this browser?')) {
                db.pops = db.pops.filter((x) => x.id !== p.id);
                save();
                notice = 'Pop deleted. Poof 💨';
                location.hash = '#/';
            }
        } else if (action === 'del-expense') {
            if (confirm('Delete this bill?')) {
                p.expenses = p.expenses.filter((x) => x.id !== el.dataset.id);
                save();
                notice = 'Bill gone. Poof 💨';
                render(popView(p));
            }
        } else if (action === 'settle') {
            const cents = parseInt(el.dataset.cents, 10);
            if (cents > 0) {
                p.settlements.push({ id: uid(), from: el.dataset.from, to: el.dataset.to, cents });
                save();
                notice = 'Debt cleared! Friendship saved 🤝';
                render(popView(p));
            }
        } else if (action === 'unsettle') {
            p.settlements = p.settlements.filter((x) => x.id !== el.dataset.id);
            save();
            notice = 'Payment undone ↩️';
            render(popView(p));
        }
    });

    app.addEventListener('change', (e) => { if (e.target.name === 'split_mode') syncMode(); });
    app.addEventListener('input', (e) => { if (e.target.matches('[data-amount], [data-custom]')) updateLeft(); });
    window.addEventListener('hashchange', route);

    route();
})();
