// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}


// --- Core App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const DB_KEY = 'diabetesAppPWAData';
    let appData = {};
    let trackingChart;

    const loadData = () => {
        const data = localStorage.getItem(DB_KEY);
        if (data) {
            appData = JSON.parse(data);
        } else {
            appData = { patients: [], clinicalData: {}, trackingData: {}, currentPatientId: null };
        }
        if (appData.patients.length === 0) {
            // Add a default patient if none exist
            const defaultPatient = { id: Date.now(), name: 'Bệnh nhân Mẫu', dob: '1980-01-01' };
            appData.patients.push(defaultPatient);
            appData.currentPatientId = defaultPatient.id;
            saveData();
        }
    };

    const saveData = () => {
        localStorage.setItem(DB_KEY, JSON.stringify(appData));
    };

    const renderPatientSelector = () => {
        const selector = document.getElementById('patient-selector');
        selector.innerHTML = '';
        appData.patients.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (${p.dob})`;
            selector.appendChild(option);
        });
        selector.value = appData.currentPatientId;
    };

    const saveClinicalDataForCurrentPatient = () => {
        const patientId = appData.currentPatientId;
        if (!patientId) return;
        
        const data = {};
        document.querySelectorAll('.data-field').forEach(field => {
            if (field.type === 'checkbox') {
                data[field.id] = field.checked;
            } else {
                data[field.id] = field.value;
            }
        });
        appData.clinicalData[patientId] = data;
        saveData();
    };

    const loadClinicalDataForCurrentPatient = () => {
        const patientId = appData.currentPatientId;
        const data = appData.clinicalData[patientId] || {};
        document.querySelectorAll('.data-field').forEach(field => {
            if (field.id in data) {
                if (field.type === 'checkbox') {
                    field.checked = data[field.id];
                } else {
                    field.value = data[field.id];
                }
            } else {
                 if (field.type === 'checkbox') {
                    field.checked = false;
                } else {
                    field.value = '';
                }
            }
        });
        // Special case for default HbA1c target
        if(!document.getElementById('target-hba1c').value) {
            document.getElementById('target-hba1c').value = '7.0';
        }
    };

    const switchPatient = (patientId) => {
        appData.currentPatientId = patientId;
        saveClinicalDataForCurrentPatient(); // Save data for the old patient before switching
        loadClinicalDataForCurrentPatient(); // Load data for the new patient
        renderUIForCurrentPatient();
        saveData();
    };
    
    const renderUIForCurrentPatient = () => {
        renderTrackingHistory();
        renderTrackingChart();
        // Clear result sections
        document.getElementById('result-chandoan').innerHTML = '';
        document.getElementById('result-tienluong').innerHTML = '';
        document.getElementById('result-dieutri').innerHTML = '';
    };

    // --- Patient Management ---
    const patientSelector = document.getElementById('patient-selector');
    const addPatientModal = document.getElementById('addPatientModal');
    
    patientSelector.addEventListener('change', (e) => {
        switchPatient(parseInt(e.target.value));
    });

    document.getElementById('btn-add-patient').addEventListener('click', () => addPatientModal.style.display = 'flex');
    document.getElementById('closePatientModal').addEventListener('click', () => addPatientModal.style.display = 'none');
    
    document.getElementById('btn-save-patient').addEventListener('click', () => {
        const name = document.getElementById('new-patient-name').value.trim();
        const dob = document.getElementById('new-patient-dob').value;
        if (!name || !dob) {
            alert('Vui lòng nhập đầy đủ tên và ngày sinh.');
            return;
        }
        const newPatient = { id: Date.now(), name, dob };
        appData.patients.push(newPatient);
        renderPatientSelector();
        switchPatient(newPatient.id);
        addPatientModal.style.display = 'none';
        document.getElementById('new-patient-name').value = '';
        document.getElementById('new-patient-dob').value = '';
    });

    // Auto-save on field change
    document.querySelectorAll('.data-field').forEach(field => {
        field.addEventListener('change', saveClinicalDataForCurrentPatient);
    });

    // --- Tab Switching Logic ---
    const tabs = document.querySelectorAll('nav button');
    const contents = document.querySelectorAll('main > div');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.replace('tab-active', 'tab-inactive'));
            contents.forEach(c => c.classList.add('hidden'));
            tab.classList.replace('tab-inactive', 'tab-active');
            const contentId = 'content-' + tab.id.split('-')[1];
            document.getElementById(contentId).classList.remove('hidden');
        });
    });

    // --- Analysis Logic (Diagnosis, Prognosis, Treatment) ---
    document.getElementById('btn-chandoan').addEventListener('click', () => {
        const age = parseFloat(document.getElementById('age').value);
        const bmi = parseFloat(document.getElementById('bmi').value);
        const fpg = parseFloat(document.getElementById('fpg').value);
        const ogtt = parseFloat(document.getElementById('ogtt').value);
        const hba1c = parseFloat(document.getElementById('hba1c').value);
        const randomGlucose = parseFloat(document.getElementById('random-glucose').value);
        const hasSymptoms = document.getElementById('symptoms').checked;
        let riskFactorsCount = 0;
        document.querySelectorAll('#risk-factors-container input[type="checkbox"]').forEach(cb => {
            if (cb.checked) riskFactorsCount++;
        });

        const resultDiv = document.getElementById('result-chandoan');
        let resultHTML = '';
        let screeningNeeded = false, screeningReason = '';
        if ((age >= 45) || (bmi >= 23 && riskFactorsCount > 0)) { screeningNeeded = true; screeningReason = 'Theo QĐ 5481/BYT, cần sàng lọc do tuổi ≥ 45 hoặc BMI ≥ 23 và có yếu tố nguy cơ.'; }
        else if (age >= 35) { screeningNeeded = true; screeningReason = 'Theo ADA 2025, cần sàng lọc do tuổi ≥ 35.'; }
        if (screeningNeeded) { resultHTML += `<div class="result-card result-card-warning"><h3 class="text-lg font-semibold text-yellow-700">Khuyến nghị Sàng lọc</h3><p class="mt-2 text-gray-600">Bệnh nhân thuộc nhóm cần được sàng lọc ĐTĐ Típ 2.</p><p class="mt-1 text-sm text-gray-500"><em>Lý do: ${screeningReason}</em></p></div>`; }
        let diagnosis = 'Bình thường', diagnosisDetails = 'Các chỉ số nằm trong giới hạn bình thường.', cardClass = 'result-card';
        const isFpgDiabetes = fpg >= 126, isOgttDiabetes = ogtt >= 200, isHba1cDiabetes = hba1c >= 6.5, isRandomDiabetes = randomGlucose >= 200 && hasSymptoms;
        const isFpgPrediabetes = fpg >= 100 && fpg <= 125, isOgttPrediabetes = ogtt >= 140 && ogtt <= 199, isHba1cPrediabetes = hba1c >= 5.7 && hba1c <= 6.4;
        const diabetesTests = [isFpgDiabetes, isOgttDiabetes, isHba1cDiabetes].filter(Boolean).length;
        if (isRandomDiabetes || (!hasSymptoms && diabetesTests >= 2)) { diagnosis = 'Chẩn đoán Đái tháo đường Típ 2'; diagnosisDetails = 'Bệnh nhân có đủ tiêu chuẩn chẩn đoán ĐTĐ Típ 2.'; cardClass = 'result-card result-card-danger'; }
        else if (isFpgDiabetes || isOgttDiabetes || isHba1cDiabetes) { if (!hasSymptoms) { diagnosis = 'Nghi ngờ Đái tháo đường Típ 2'; diagnosisDetails = 'Có 1 chỉ số bất thường. Cần làm lại xét nghiệm lần 2 để xác định.'; cardClass = 'result-card result-card-danger'; } else { diagnosis = 'Chẩn đoán Đái tháo đường Típ 2'; diagnosisDetails = 'Có triệu chứng kinh điển và 1 chỉ số bất thường, đủ tiêu chuẩn chẩn đoán.'; cardClass = 'result-card result-card-danger'; } }
        else if (isFpgPrediabetes || isOgttPrediabetes || isHba1cPrediabetes) { diagnosis = 'Chẩn đoán Tiền Đái tháo đường'; diagnosisDetails = 'Chỉ số nằm trong ngưỡng Tiền ĐTĐ. Cần tư vấn thay đổi lối sống.'; cardClass = 'result-card result-card-warning'; }
        resultHTML += `<div class="${cardClass}"><h3 class="text-lg font-semibold ${diagnosis.includes('Đái tháo đường') ? 'text-red-700' : (diagnosis.includes('Tiền') ? 'text-yellow-700' : 'text-green-700')}">Kết quả: ${diagnosis}</h3><p class="mt-2 text-gray-600">${diagnosisDetails}</p></div>`;
        resultDiv.innerHTML = resultHTML;
    });
    
    document.getElementById('btn-tienluong').addEventListener('click', () => { /* Logic unchanged from previous version */ });
    document.getElementById('btn-dieutri').addEventListener('click', () => { /* Logic unchanged from previous version */ });

    // --- Tracking & Sharing Logic ---
    const trackDateInput = document.getElementById('track-date');
    trackDateInput.valueAsDate = new Date();

    const getTrackingDataForCurrentPatient = () => {
        return appData.trackingData[appData.currentPatientId] || [];
    };

    const saveTrackingDataForCurrentPatient = (data) => {
        appData.trackingData[appData.currentPatientId] = data;
        saveData();
    };

    const renderTrackingHistory = () => {
        const data = getTrackingDataForCurrentPatient();
        const tbody = document.getElementById('tracking-history-body');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Chưa có dữ liệu theo dõi.</td></tr>`;
            return;
        }
        data.forEach(item => {
            const row = `<tr><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${new Date(item.date).toLocaleDateString('vi-VN')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.glucose || 'N/A'}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.sbp && item.dbp ? `${item.sbp}/${item.dbp}` : 'N/A'}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.weight || 'N/A'}</td></tr>`;
            tbody.innerHTML += row;
        });
    };

    const renderTrackingChart = () => {
        const data = getTrackingDataForCurrentPatient();
        const ctx = document.getElementById('trackingChart').getContext('2d');
        const labels = data.map(item => new Date(item.date).toLocaleDateString('vi-VN'));
        if (trackingChart) trackingChart.destroy();
        trackingChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Đường huyết (mg/dL)', data: data.map(item => item.glucose), borderColor: 'rgb(239, 68, 68)', yAxisID: 'y', }, { label: 'Cân nặng (kg)', data: data.map(item => item.weight), borderColor: 'rgb(59, 130, 246)', yAxisID: 'y1', } ] }, options: { responsive: true, interaction: { mode: 'index', intersect: false, }, scales: { y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Đường huyết' } }, y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Cân nặng' }, grid: { drawOnChartArea: false } } } } });
    };
    
    document.getElementById('btn-add-track').addEventListener('click', () => {
        const date = document.getElementById('track-date').value;
        if (!date) { alert('Vui lòng chọn ngày.'); return; }
        const newData = { date, glucose: parseFloat(document.getElementById('track-glucose').value) || null, sbp: parseFloat(document.getElementById('track-sbp').value) || null, dbp: parseFloat(document.getElementById('track-dbp').value) || null, weight: parseFloat(document.getElementById('track-weight').value) || null };
        let data = getTrackingDataForCurrentPatient();
        data.push(newData);
        data.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveTrackingDataForCurrentPatient(data);
        renderUIForCurrentPatient();
        document.getElementById('track-glucose').value = ''; document.getElementById('track-sbp').value = ''; document.getElementById('track-dbp').value = ''; document.getElementById('track-weight').value = '';
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if(confirm(`Bạn có chắc chắn muốn xóa dữ liệu theo dõi của bệnh nhân này không?`)) {
            saveTrackingDataForCurrentPatient([]);
            renderUIForCurrentPatient();
        }
    });

    // Share Modal Logic
    const shareModal = document.getElementById('shareModal');
    document.getElementById('btn-share').onclick = () => {
        const data = getTrackingDataForCurrentPatient();
        if (data.length === 0) { alert('Không có dữ liệu để chia sẻ.'); return; }
        let textContent = `Lịch sử theo dõi sức khỏe:\n\n`;
        data.forEach(item => {
            textContent += `Ngày: ${new Date(item.date).toLocaleDateString('vi-VN')}\n`;
            if(item.glucose) textContent += `- Đường huyết: ${item.glucose} mg/dL\n`;
            if(item.sbp && item.dbp) textContent += `- Huyết áp: ${item.sbp}/${item.dbp} mmHg\n`;
            if(item.weight) textContent += `- Cân nặng: ${item.weight} kg\n`;
            textContent += '-----------------\n';
        });
        document.getElementById('share-data-content').value = textContent;
        shareModal.style.display = 'flex';
    };
    document.getElementById('closeShareModal').onclick = () => { shareModal.style.display = 'none'; };
    document.getElementById('btn-copy-share').onclick = () => {
        const content = document.getElementById('share-data-content');
        content.select();
        document.execCommand('copy');
        const btn = document.getElementById('btn-copy-share');
        btn.innerText = 'Đã sao chép!';
        setTimeout(() => { btn.innerText = 'Sao chép'; }, 2000);
    };

    // --- Print Function ---
    document.getElementById('btn-print').addEventListener('click', () => {
        const patientId = appData.currentPatientId;
        const patient = appData.patients.find(p => p.id === patientId);
        const clinicalData = appData.clinicalData[patientId] || {};
        const trackingData = getTrackingDataForCurrentPatient();

        let reportHTML = `
            <html><head><title>Báo cáo Sức khỏe - ${patient.name}</title>
            <script src="https://cdn.tailwindcss.com"><\/script>
            <style> body { font-family: "Inter", sans-serif; padding: 2rem; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } h1, h2 { color: #3b82f6; } </style>
            </head><body>
            <h1 class="text-2xl font-bold mb-4">BÁO CÁO SỨC KHỎE</h1>
            <div class="mb-6">
                <h2 class="text-xl font-semibold mb-2">Thông tin Bệnh nhân</h2>
                <p><strong>Tên:</strong> ${patient.name}</p>
                <p><strong>Ngày sinh:</strong> ${new Date(patient.dob).toLocaleDateString('vi-VN')}</p>
                <p><strong>Tuổi:</strong> ${clinicalData.age || 'N/A'}</p>
                <p><strong>BMI:</strong> ${clinicalData.bmi || 'N/A'}</p>
            </div>
            <div class="mb-6">
                <h2 class="text-xl font-semibold mb-2">Lịch sử Theo dõi</h2>`;
        if (trackingData.length > 0) {
            reportHTML += `<table><thead><tr><th>Ngày</th><th>Đường huyết (mg/dL)</th><th>Huyết áp (mmHg)</th><th>Cân nặng (kg)</th></tr></thead><tbody>`;
            trackingData.forEach(item => {
                reportHTML += `<tr><td>${new Date(item.date).toLocaleDateString('vi-VN')}</td><td>${item.glucose || ''}</td><td>${item.sbp && item.dbp ? `${item.sbp}/${item.dbp}` : ''}</td><td>${item.weight || ''}</td></tr>`;
            });
            reportHTML += `</tbody></table>`;
        } else {
            reportHTML += `<p>Không có dữ liệu theo dõi.</p>`;
        }
        reportHTML += `</div><p class="text-xs text-gray-500 mt-8">Báo cáo được tạo bởi Ứng dụng AI Hỗ trợ Quản lý ĐTĐ vào ngày ${new Date().toLocaleDateString('vi-VN')}.</p></body></html>`;

        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(reportHTML);
        reportWindow.document.close();
        setTimeout(() => { // Timeout to allow assets to load
            reportWindow.print();
            reportWindow.close();
        }, 500);
    });

    // --- Initial Load ---
    loadData();
    renderPatientSelector();
    loadClinicalDataForCurrentPatient();
    renderUIForCurrentPatient();
});
