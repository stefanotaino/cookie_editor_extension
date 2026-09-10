document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  const url = new URL(tab.url);
  const domain = url.hostname;
  document.getElementById('domain').textContent = `Domain: ${domain}`;

  const statusEl = document.getElementById('status-msg');
  let statusTimeout;

  function showStatus(text, isError = false) {
    clearTimeout(statusTimeout);
    statusEl.style.color = isError ? '#cc3333' : '#28a745';
    statusEl.textContent = text;
    statusTimeout = setTimeout(() => {
      statusEl.textContent = '';
    }, 3500);
  }

  async function loadCookies() {
    const cookies = await chrome.cookies.getAll({ domain: domain });
    const listEl = document.getElementById('cookie-list');
    listEl.innerHTML = '';

    if (cookies.length === 0) {
      listEl.innerHTML = '<div style="padding: 8px; text-align: center; color: #777; font-size: 11px;">No cookies found for this domain.</div>';
      document.getElementById('export-json-data').value = '[]';
      return;
    }

    document.getElementById('export-json-data').value = JSON.stringify(cookies, null, 2);

    cookies.forEach(cookie => {
      const item = document.createElement('div');
      item.className = 'cookie-item';

      const info = document.createElement('div');
      info.className = 'cookie-info';
      info.innerHTML = `<span class="cookie-name">${cookie.name}</span>: ${cookie.value}`;
      info.title = `${cookie.name}=${cookie.value}`;

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Del';
      delBtn.className = 'danger';
      delBtn.style.flex = '0 0 auto';
      delBtn.onclick = async () => {
        const protocol = cookie.secure ? 'https:' : 'http:';
        const cookieUrl = `${protocol}//${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
        showStatus(`Deleted cookie: ${cookie.name}`);
        loadCookies();
      };

      item.appendChild(info);
      item.appendChild(delBtn);
      listEl.appendChild(item);
    });
  }

  document.getElementById('export-file').onclick = () => {
    const data = document.getElementById('export-json-data').value;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domain}_cookies.json`;
    a.click();
    showStatus('JSON file downloaded!');
  };

  document.getElementById('import-json').onclick = async () => {
    try {
      const rawData = document.getElementById('import-json-data').value;
      const cookiesArray = JSON.parse(rawData);

      if (!Array.isArray(cookiesArray)) {
        showStatus('Invalid JSON cookie array.', true);
        return;
      }

      for (const cookie of cookiesArray) {
        const protocol = cookie.secure ? 'https:' : 'http:';
        let cookieDomain = cookie.domain;
        if (cookieDomain.startsWith('.')) {
          cookieDomain = cookieDomain.substring(1);
        }
        const cookieUrl = `${protocol}//${cookieDomain}${cookie.path || '/'}`;

        const cookieDetails = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'unspecified'
        };

        if (cookie.expirationDate) {
          cookieDetails.expirationDate = cookie.expirationDate;
        }

        await chrome.cookies.set(cookieDetails);
      }

      showStatus('Cookies imported successfully!');
      document.getElementById('import-json-data').value = '';
      loadCookies();
    } catch (err) {
      showStatus('Error parsing JSON: ' + err.message, true);
    }
  };

  document.getElementById('copy-curl').onclick = async () => {
    const cookies = await chrome.cookies.getAll({ domain: domain });
    if (cookies.length === 0) {
      showStatus('No cookies found for this domain.', true);
      return;
    }
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    try {
      await navigator.clipboard.writeText(cookieHeader);
      showStatus('cURL header copied to clipboard!');
    } catch (err) {
      showStatus('Failed to copy: ' + err.message, true);
    }
  };

  const addForm = document.getElementById('add-form');
  document.getElementById('toggle-add').onclick = () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('save-cookie').onclick = async () => {
    const name = document.getElementById('new-name').value.trim();
    const value = document.getElementById('new-value').value.trim();
    if (!name) {
      showStatus('Cookie name cannot be empty.', true);
      return;
    }

    await chrome.cookies.set({
      url: tab.url,
      name: name,
      value: value,
      domain: domain,
      path: '/'
    });

    document.getElementById('new-name').value = '';
    document.getElementById('new-value').value = '';
    addForm.style.display = 'none';
    showStatus(`Cookie "${name}" saved!`);
    loadCookies();
  };

  loadCookies();
});
