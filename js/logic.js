// Pure logic: money, splitting, balances, and safe import of shared pops.
// No DOM in here, so it can be tested with plain Node.
(function (root) {
    'use strict';

    const VIBES = ['🍕', '🏖️', '🏠', '🎉', '☕', '🎬', '🛒', '✈️', '🍜', '🎮'];
    const CURRENCIES = ['₹', '$', '€', '£'];

    // All money is whole paise/cents. No floats in the maths.
    function toCents(v) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }

    function fmt(cents, sym) {
        const abs = Math.abs(cents);
        const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return (cents < 0 ? '-' : '') + sym + whole + '.' + String(abs % 100).padStart(2, '0');
    }

    // Leftover paise go one each to the first people, so shares add up exactly.
    function splitEqual(total, ids) {
        const out = {};
        const n = ids.length;
        if (!n) return out;
        const base = Math.floor(total / n);
        const rem = total % n;
        ids.forEach((id, i) => { out[id] = base + (i < rem ? 1 : 0); });
        return out;
    }

    // net > 0: gets money back. net < 0: owes money. Returns the fewest payments to settle.
    function compute(memberIds, expenses, settlements) {
        const net = {};
        memberIds.forEach((id) => { net[id] = 0; });

        expenses.forEach((e) => {
            net[e.paidBy] = (net[e.paidBy] || 0) + e.amount;
            Object.keys(e.shares).forEach((m) => { net[m] = (net[m] || 0) - e.shares[m]; });
        });
        settlements.forEach((s) => {
            net[s.from] = (net[s.from] || 0) + s.amount;
            net[s.to] = (net[s.to] || 0) - s.amount;
        });

        const creditors = [];
        const debtors = [];
        Object.keys(net).forEach((id) => {
            if (net[id] > 0) creditors.push({ id, amt: net[id] });
            else if (net[id] < 0) debtors.push({ id, amt: -net[id] });
        });
        const order = (a, b) => (b.amt - a.amt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        creditors.sort(order);
        debtors.sort(order);

        const transfers = [];
        let i = 0;
        let j = 0;
        while (i < creditors.length && j < debtors.length) {
            const pay = Math.min(creditors[i].amt, debtors[j].amt);
            transfers.push({ from: debtors[j].id, to: creditors[i].id, amount: pay });
            creditors[i].amt -= pay;
            debtors[j].amt -= pay;
            if (creditors[i].amt === 0) i++;
            if (debtors[j].amt === 0) j++;
        }
        return { net, transfers };
    }

    // Share links come from other people, so treat them as untrusted:
    // rebuild a clean pop from scratch, with fresh ids, or return null.
    function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
    function int(v, max) { return Number.isInteger(v) && v >= 0 && v <= max ? v : null; }

    function clean(raw, uid) {
        if (!raw || typeof raw !== 'object') return null;
        const name = str(raw.name, 60);
        if (!name) return null;

        const map = new Map();
        const members = [];
        (Array.isArray(raw.members) ? raw.members.slice(0, 20) : []).forEach((m) => {
            const n = m && typeof m === 'object' ? str(m.name, 40) : '';
            const oid = m && typeof m.id === 'string' ? m.id : null;
            if (!n || !oid || map.has(oid)) return;
            const id = uid();
            map.set(oid, id);
            members.push({ id, name: n });
        });
        if (members.length < 2) return null;

        const expenses = [];
        (Array.isArray(raw.expenses) ? raw.expenses.slice(0, 500) : []).forEach((e) => {
            if (!e || typeof e !== 'object') return;
            const cents = int(e.cents, 1e11);
            const paidBy = map.get(e.paidBy);
            if (!cents || !paidBy || !e.shares || typeof e.shares !== 'object') return;
            const shares = {};
            let sum = 0;
            for (const k of Object.keys(e.shares)) {
                const nid = map.get(k);
                const c = int(e.shares[k], 1e11);
                if (!nid || c === null) return;
                if (c > 0) { shares[nid] = c; sum += c; }
            }
            if (sum !== cents) return;
            expenses.push({
                id: uid(),
                title: str(e.title, 80) || 'Mystery spend',
                cents,
                paidBy,
                date: typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : '',
                shares,
            });
        });

        const settlements = [];
        (Array.isArray(raw.settlements) ? raw.settlements.slice(0, 500) : []).forEach((s) => {
            if (!s || typeof s !== 'object') return;
            const from = map.get(s.from);
            const to = map.get(s.to);
            const cents = int(s.cents, 1e11);
            if (!from || !to || from === to || !cents) return;
            settlements.push({ id: uid(), from, to, cents });
        });

        return {
            id: uid(),
            name,
            emoji: VIBES.includes(raw.emoji) ? raw.emoji : VIBES[0],
            currency: CURRENCIES.includes(raw.currency) ? raw.currency : '₹',
            members,
            expenses,
            settlements,
        };
    }

    const api = { VIBES, CURRENCIES, toCents, fmt, splitEqual, compute, clean };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SplitLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
