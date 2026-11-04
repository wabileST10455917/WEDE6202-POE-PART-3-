/* ============================================================
   Whole Shoes Nduna — script.js  (Part 3: functionality)

   What this file does
   1. Mobile navigation toggle and footer year (all pages).
   2. Enquiry form (enquiry.html): validates every field, then
      uses AJAX (fetch) to load pricing.json WITHOUT reloading the
      page and shows the visitor a quote with cost, availability
      and turnaround.
   3. Contact form (contact.html): validates every field, then
      compiles the details into an email that the visitor can send
      to the recipient set in CONFIG.recipient below.

   Everything is wrapped in one DOMContentLoaded handler so the
   HTML has finished loading before any element is looked up.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---------- Settings you may need to change ---------- */
  var CONFIG = {
    recipient: 'hello@wholeshoesnduna.co.za', // who receives contact-form emails
    pricingUrl: 'data/pricing.json',          // file loaded via AJAX
    maxAdvanceDays: 90                        // furthest-ahead date allowed
  };

  /* If pricing.json cannot be loaded (for example when the page is
     opened straight from the hard drive, where browsers block fetch),
     this copy keeps the enquiry form working. Keep it in step with
     data/pricing.json. */
  var FALLBACK_PRICING = {
    items: {
      sneakers: { label: 'Sneakers & trainers', group: 'shoes', price: 699, unit: 'per pair', availability: 'In stock', lead: 'Available today in-store', unavailableSizes: [12, 13] },
      formal:   { label: 'Leather & office shoes', group: 'shoes', price: 1199, unit: 'per pair', availability: 'In stock', lead: 'Available today in-store', unavailableSizes: [3, 13] },
      school:   { label: 'School & everyday shoes', group: 'shoes', price: 449, unit: 'per pair', availability: 'In stock', lead: 'Available today in-store', unavailableSizes: [] },
      boots:    { label: 'Handcrafted leather boots', group: 'shoes', price: 1650, unit: 'per pair', availability: 'Made to order', lead: 'Ready in about 7 working days', unavailableSizes: [] },
      resole:   { label: 'Resoling', group: 'repairs', price: 320, unit: 'per pair', availability: 'Bench open', lead: 'Ready in 3-5 working days', unavailableSizes: [] },
      restitch: { label: 'Restitching', group: 'repairs', price: 180, unit: 'per pair', availability: 'Bench open', lead: 'Ready in 3-5 working days', unavailableSizes: [] },
      polish:   { label: 'Polish & condition', group: 'repairs', price: 110, unit: 'per pair', availability: 'Bench open', lead: 'Ready in 2-3 working days', unavailableSizes: [] },
      zip:      { label: 'Zip & lace repair', group: 'repairs', price: 95, unit: 'per pair', availability: 'Bench open', lead: 'Ready in 3-5 working days', unavailableSizes: [] },
      fitting:  { label: 'Guided foot fitting', group: 'services', price: 0, unit: 'free', availability: 'Walk-ins welcome', lead: 'About 20 minutes, no booking needed', unavailableSizes: [] },
      delivery: { label: 'Local delivery (Nelspruit & Mbombela)', group: 'services', price: 45, unit: 'flat rate (free over R700)', availability: 'Available', lead: '1-2 working days', unavailableSizes: [] }
    },
    freeDeliveryThreshold: 700,
    openDays: [1, 2, 3, 4, 5, 6]
  };

  /* ============================================================
     1. SHARED: navigation toggle + footer year
     ============================================================ */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ============================================================
     2. VALIDATION HELPERS (used by both forms)
     Each validator returns an error message, or '' when valid.
     ============================================================ */
  function value(field) { return (field.value || '').trim(); }

  function checkName(field) {
    var v = value(field);
    if (!v) return 'Please enter your full name.';
    if (v.length < 2 || v.length > 60) return 'Your name must be between 2 and 60 characters.';
    if (!/^[A-Za-z\u00C0-\u017F][A-Za-z\u00C0-\u017F '.\-]*$/.test(v)) return 'Your name may only contain letters, spaces, apostrophes, full stops and hyphens.';
    return '';
  }

  function checkEmail(field) {
    var v = value(field);
    if (!v) return 'Please enter your email address.';
    if (v.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address, for example name@example.com.';
    return '';
  }

  // South African numbers: 0821234567 or +27821234567 (spaces/dashes allowed).
  function checkPhone(field, required) {
    var v = value(field);
    if (!v) return required ? 'Please enter your phone number.' : '';
    var digits = v.replace(/[\s\-()]/g, '');
    if (!/^(\+27|0)[1-9][0-9]{8}$/.test(digits)) return 'Please enter a valid South African number, for example 082 123 4567 or +27 82 123 4567.';
    return '';
  }

  function checkLength(field, min, max, what) {
    var v = value(field);
    if (!v) return min > 0 ? 'Please enter ' + what + '.' : '';
    if (v.length < min) return what.charAt(0).toUpperCase() + what.slice(1) + ' must be at least ' + min + ' characters (you have ' + v.length + ').';
    if (v.length > max) return what.charAt(0).toUpperCase() + what.slice(1) + ' must be no more than ' + max + ' characters (you have ' + v.length + ').';
    return '';
  }

  function checkSelect(field, message) {
    return value(field) ? '' : message;
  }

  function checkNumber(field, min, max, what) {
    var v = value(field);
    if (!v) return 'Please enter ' + what + '.';
    var n = Number(v);
    if (!/^\d+$/.test(v) || n < min || n > max) return what.charAt(0).toUpperCase() + what.slice(1) + ' must be a whole number from ' + min + ' to ' + max + '.';
    return '';
  }

  function toISO(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Optional date: must be a real date, not in the past, not too far ahead.
  function checkDate(field) {
    var v = value(field);
    if (!v) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Please choose a date from the calendar.';
    var chosen = new Date(v + 'T00:00:00');
    if (isNaN(chosen.getTime())) return 'That date does not exist. Please choose another.';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var latest = new Date(today); latest.setDate(latest.getDate() + CONFIG.maxAdvanceDays);
    if (chosen < today) return 'Please choose today or a future date.';
    if (chosen > latest) return 'Please choose a date within the next ' + CONFIG.maxAdvanceDays + ' days.';
    return '';
  }

  function checkConsent(field) {
    return field.checked ? '' : 'Please tick the box so we may reply to you.';
  }

  /* Show or clear an error under a field. The message sits in a
     <span id="<fieldId>-error"> placed next to the field. */
  function showError(field, message) {
    var holder = document.getElementById(field.id + '-error');
    if (message) {
      field.classList.add('field-invalid');
      field.setAttribute('aria-invalid', 'true');
      if (holder) { holder.textContent = message; holder.hidden = false; field.setAttribute('aria-describedby', holder.id); }
    } else {
      field.classList.remove('field-invalid');
      field.removeAttribute('aria-invalid');
      if (holder) { holder.textContent = ''; holder.hidden = true; }
    }
    return message;
  }

  /* Run every rule for a form. rules = [[field, function], ...].
     Returns the first invalid field (so we can focus it) or null. */
  function runRules(rules) {
    var firstBad = null;
    rules.forEach(function (rule) {
      var field = rule[0];
      if (field.closest('[hidden]')) { showError(field, ''); return; } // skip hidden fields
      var message = showError(field, rule[1]());
      if (message && !firstBad) firstBad = field;
    });
    return firstBad;
  }

  /* After the first failed attempt, re-check each field as the
     visitor corrects it, so errors disappear straight away. */
  function liveCheck(rules) {
    rules.forEach(function (rule) {
      var field = rule[0];
      var evt = (field.tagName === 'SELECT' || field.type === 'checkbox' || field.type === 'date') ? 'change' : 'input';
      field.addEventListener(evt, function () { showError(field, rule[1]()); });
      field.addEventListener('blur', function () { showError(field, rule[1]()); });
    });
  }

  function setStatus(box, kind, text) {
    box.className = 'form-msg show ' + kind;
    box.textContent = text;
  }

  function formatRand(n) {
    return 'R' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function longDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ============================================================
     3. ENQUIRY FORM  (enquiry.html)
     validate -> AJAX fetch of pricing.json -> show a quote
     ============================================================ */
  var enquiry = document.getElementById('enquiry-form');
  if (enquiry) {
    enquiry.noValidate = true; // our own messages replace the browser's pop-ups

    var f = {
      name: document.getElementById('eq-name'),
      email: document.getElementById('eq-email'),
      phone: document.getElementById('eq-phone'),
      item: document.getElementById('eq-item'),
      size: document.getElementById('eq-size'),
      qty: document.getElementById('eq-qty'),
      fulfil: document.getElementById('eq-fulfil'),
      date: document.getElementById('eq-date'),
      notes: document.getElementById('eq-notes'),
      consent: document.getElementById('eq-consent')
    };
    var sizeRow = document.getElementById('eq-size-row');
    var fulfilRow = document.getElementById('eq-fulfil-row');
    var status = enquiry.querySelector('.form-msg');
    var result = document.getElementById('enquiry-result');

    // The calendar only offers today onwards (DOM manipulation).
    var todayDate = new Date();
    f.date.min = toISO(todayDate);
    var lastDate = new Date(todayDate); lastDate.setDate(lastDate.getDate() + CONFIG.maxAdvanceDays);
    f.date.max = toISO(lastDate);

    function selectedGroup() {
      var opt = f.item.options[f.item.selectedIndex];
      return opt && opt.dataset ? opt.dataset.group || '' : '';
    }

    // Show the size field only for shoes, and delivery choice for shoes/repairs.
    function updateConditionalFields() {
      var group = selectedGroup();
      sizeRow.hidden = group !== 'shoes';
      fulfilRow.hidden = !(group === 'shoes' || group === 'repairs');
    }
    f.item.addEventListener('change', updateConditionalFields);
    updateConditionalFields();

    var enquiryRules = [
      [f.name,    function () { return checkName(f.name); }],
      [f.email,   function () { return checkEmail(f.email); }],
      [f.phone,   function () { return checkPhone(f.phone, false); }],
      [f.item,    function () { return checkSelect(f.item, 'Please choose what you would like to enquire about.'); }],
      [f.size,    function () { return checkSelect(f.size, 'Please choose a shoe size.'); }],
      [f.qty,     function () { return checkNumber(f.qty, 1, 10, 'the quantity'); }],
      [f.date,    function () { return checkDate(f.date); }],
      [f.notes,   function () { return checkLength(f.notes, 0, 500, 'your notes'); }],
      [f.consent, function () { return checkConsent(f.consent); }]
    ];
    liveCheck(enquiryRules);

    // AJAX: ask the server for pricing.json without leaving the page.
    function loadPricing() {
      return fetch(CONFIG.pricingUrl, { headers: { 'Accept': 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .catch(function () { return FALLBACK_PRICING; });
    }

    function line(label, text) {
      var p = document.createElement('p');
      var strong = document.createElement('strong');
      strong.textContent = label + ' ';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(text));
      return p;
    }

    function buildQuote(data) {
      var item = data.items[f.item.value];
      var qty = Number(f.qty.value);
      var group = item.group;
      var box = document.createElement('div');

      var title = document.createElement('h3');
      title.textContent = 'Thank you, ' + value(f.name).split(' ')[0] + ' — here is your quote';
      box.appendChild(title);

      box.appendChild(line('Enquiry:', item.label + (group === 'shoes' ? ' (size ' + f.size.value + ')' : '')));

      // ---- cost ----
      var subtotal = item.price * qty;
      var costText = item.price === 0 ? 'Free of charge.' : formatRand(item.price) + ' ' + item.unit + (qty > 1 ? ' × ' + qty + ' = ' + formatRand(subtotal) : '') + '.';
      box.appendChild(line('Cost:', costText));

      var deliveryCost = 0;
      if ((group === 'shoes' || group === 'repairs') && f.fulfil.value === 'delivery') {
        deliveryCost = subtotal >= data.freeDeliveryThreshold ? 0 : data.items.delivery.price;
        box.appendChild(line('Delivery:', deliveryCost === 0 ? 'Free (your order is over ' + formatRand(data.freeDeliveryThreshold) + ').' : formatRand(deliveryCost) + ' flat rate within Nelspruit and Mbombela, 1-2 working days.'));
        box.appendChild(line('Estimated total:', formatRand(subtotal + deliveryCost) + '.'));
      } else if (group === 'shoes' || group === 'repairs') {
        box.appendChild(line('Collection:', 'Free click & collect from Ilanga Mall, ready within 2 hours.'));
        box.appendChild(line('Estimated total:', formatRand(subtotal) + '.'));
      }

      // ---- availability ----
      var avail = item.availability + ' — ' + item.lead + '.';
      if (group === 'shoes' && item.unavailableSizes.indexOf(Number(f.size.value)) !== -1) {
        avail = 'Size ' + f.size.value + ' is out of stock right now. We can order it in, usually within 3-5 working days.';
      }
      box.appendChild(line('Availability:', avail));

      // ---- preferred date vs opening days ----
      if (f.date.value) {
        var chosen = new Date(f.date.value + 'T00:00:00');
        if (data.openDays.indexOf(chosen.getDay()) === -1) {
          var next = new Date(chosen);
          do { next.setDate(next.getDate() + 1); } while (data.openDays.indexOf(next.getDay()) === -1);
          box.appendChild(line('Your preferred date:', longDate(f.date.value) + ' — we are closed on Sundays. The next day we are open is ' + longDate(toISO(next)) + '.'));
        } else {
          box.appendChild(line('Your preferred date:', longDate(f.date.value) + ' — we will expect you. Hours: Mon-Fri 09:00-18:00, Sat 09:00-16:00.'));
        }
      }

      var foot = document.createElement('p');
      foot.className = 'quote-note';
      foot.textContent = 'This is an estimate based on our current prices. A team member will confirm stock when you reply to the email we have on file (' + value(f.email) + ') or when you visit.';
      box.appendChild(foot);
      return box;
    }

    enquiry.addEventListener('submit', function (event) {
      event.preventDefault();               // stop the page reloading
      result.hidden = true;

      var firstBad = runRules(enquiryRules);
      if (firstBad) {
        setStatus(status, 'err', 'Please fix the highlighted fields and try again.');
        firstBad.focus();
        return;
      }

      setStatus(status, 'ok', 'Checking prices and stock…');
      var button = enquiry.querySelector('button[type="submit"]');
      button.disabled = true;

      loadPricing().then(function (data) {
        result.innerHTML = '';
        result.appendChild(buildQuote(data));
        result.hidden = false;
        setStatus(status, 'ok', 'Done — your quote is shown below.');
        result.setAttribute('tabindex', '-1');
        result.focus();
      }).catch(function () {
        setStatus(status, 'err', 'Sorry, something went wrong while preparing your quote. Please call +27 13 450 0198.');
      }).then(function () {
        button.disabled = false;
      });
    });
  }

  /* ============================================================
     4. CONTACT FORM  (contact.html)
     validate -> compile an email -> visitor sends it (mailto:)
     ============================================================ */
  var contact = document.getElementById('contact-form');
  if (contact) {
    contact.noValidate = true;

    var c = {
      name: document.getElementById('ct-name'),
      email: document.getElementById('ct-email'),
      phone: document.getElementById('ct-phone'),
      type: document.getElementById('ct-type'),
      subject: document.getElementById('ct-subject'),
      message: document.getElementById('ct-message'),
      consent: document.getElementById('ct-consent')
    };
    var counter = document.getElementById('ct-message-count');
    var cStatus = contact.querySelector('.form-msg');
    var preview = document.getElementById('contact-preview');

    var contactRules = [
      [c.name,    function () { return checkName(c.name); }],
      [c.email,   function () { return checkEmail(c.email); }],
      [c.phone,   function () { return checkPhone(c.phone, false); }],
      [c.type,    function () { return checkSelect(c.type, 'Please choose the type of message.'); }],
      [c.subject, function () { return checkLength(c.subject, 3, 80, 'the subject'); }],
      [c.message, function () { return checkLength(c.message, 10, 1000, 'your message'); }],
      [c.consent, function () { return checkConsent(c.consent); }]
    ];
    liveCheck(contactRules);

    // Live character counter (DOM manipulation).
    function updateCounter() {
      var used = c.message.value.length;
      counter.textContent = used + ' / 1000 characters';
      counter.classList.toggle('over', used > 1000);
    }
    c.message.addEventListener('input', updateCounter);
    updateCounter();

    function compileEmail() {
      var typeText = c.type.options[c.type.selectedIndex].text;
      var subject = '[' + typeText + '] ' + value(c.subject);
      var body =
        'Hello Whole Shoes Nduna,\r\n\r\n' +
        value(c.message) + '\r\n\r\n' +
        '--\r\n' +
        'Name: ' + value(c.name) + '\r\n' +
        'Email: ' + value(c.email) + '\r\n' +
        'Phone: ' + (value(c.phone) || 'not provided') + '\r\n' +
        'Message type: ' + typeText + '\r\n';
      return { to: CONFIG.recipient, subject: subject, body: body };
    }

    function renderPreview(mail) {
      preview.innerHTML = '';
      var h = document.createElement('h3');
      h.textContent = 'Your email is ready to send';
      preview.appendChild(h);

      [['To', mail.to], ['Subject', mail.subject]].forEach(function (pair) {
        var p = document.createElement('p');
        var s = document.createElement('strong');
        s.textContent = pair[0] + ': ';
        p.appendChild(s);
        p.appendChild(document.createTextNode(pair[1]));
        preview.appendChild(p);
      });

      var pre = document.createElement('pre');
      pre.className = 'email-body';
      pre.textContent = mail.body;
      preview.appendChild(pre);

      var send = document.createElement('a');
      send.className = 'btn btn-primary';
      send.textContent = 'Send email';
      send.href = 'mailto:' + mail.to + '?subject=' + encodeURIComponent(mail.subject) + '&body=' + encodeURIComponent(mail.body);
      preview.appendChild(send);

      var hint = document.createElement('p');
      hint.className = 'quote-note';
      hint.textContent = 'Clicking "Send email" opens your email app with everything filled in — press send there to deliver it.';
      preview.appendChild(hint);

      preview.hidden = false;
    }

    contact.addEventListener('submit', function (event) {
      event.preventDefault();
      preview.hidden = true;

      var firstBad = runRules(contactRules);
      if (firstBad) {
        setStatus(cStatus, 'err', 'Please fix the highlighted fields and try again.');
        firstBad.focus();
        return;
      }
      setStatus(cStatus, 'ok', 'Thank you — your email has been prepared below.');
      renderPreview(compileEmail());
      preview.setAttribute('tabindex', '-1');
      preview.focus();
    });
  }

});