const ctx = document.getElementById('dividend-chart').getContext('2d');
const ctx2 = document.getElementById("history-chart").getContext("2d");
const placeholderLabels = Array.from({ length: 10 }, (_, i) => ``);
const placeholderData = Array(10).fill(0); // Flat line at 0

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A'; // Handle empty or invalid dates
  
  // Manually create a date object by parsing the date string
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day); // month is 0-indexed

  if (isNaN(date.getTime())) return 'N/A'; // Handle invalid date formats

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SAVE AND LOAD BUTTONS


// Save all local storage data as a single JSON file
document.getElementById('save-all-data-btn').addEventListener('click', () => {
  // Create an object to store all local storage data
  const allData = {};

  // Loop through all keys in localStorage and add them to the allData object
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);

    try {
      // Try to parse the value to handle any stored objects
      allData[key] = JSON.parse(value);
    } catch (error) {
      // If parsing fails (not valid JSON), store the value as is
      allData[key] = value;
    }
  }

  // Convert allData object to a JSON string
  const allDataJSON = JSON.stringify(allData, null, 2);

  // Create a Blob from the JSON string
  const blob = new Blob([allDataJSON], { type: 'application/json' });

  // Create a download link
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'all-data.json'; // File name for the download

  // Trigger the download
  link.click();

  console.log('All local storage data saved as all-data.json');
  alert('All Data Has Been Saved.')
});

// Load all data from a JSON file and restore to localStorage
document.getElementById('load-all-data-btn').addEventListener('click', () => {
  const fileInput = document.getElementById('file-input');
  fileInput.click(); // Trigger the file input dialog

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();

      // Read the file as text
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target.result); // Parse the JSON data

          // Loop through the loaded data and store it back in localStorage
          for (const key in loadedData) {
            if (loadedData.hasOwnProperty(key)) {
              localStorage.setItem(key, JSON.stringify(loadedData[key])); // Store each item in localStorage
            }
          }

          console.log('All local storage data successfully loaded from all-data.json.');

          // Now specifically handle portfolio data (updating global array and UI)
          if (loadedData.portfolio) {
            portfolio = loadedData.portfolio; // Update global portfolio array

            // Update the total dividends
            totalDividends = portfolio.reduce((total, stock) => total + stock.stockAmount * parseFloat(stock.stockDividend), 0);

            // Re-render the portfolio and update chart
            // renderPortfolio();
            const chartData = loadChartData(); // Reload chart data from localStorage
            dividendChart.data.labels = chartData.labels;
            dividendChart.data.datasets[0].data = chartData.data;
            dividendChart.update(); // Refresh the chart with the updated data
            refreshCalendar();
          }
          
          alert('All local storage data has been restored.');

        } catch (error) {
          console.error('Failed to load data from file:', error);
          alert('Invalid JSON file.');
        }
      };

      reader.readAsText(file); // Read the file content
      
    } else {
      alert('Please select a valid JSON file.');
    }
  });
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// DIVIDEND GROWTH CHART FUNCTIONS


// Check if chart data exists in localStorage
const loadChartData = () => {
  const savedChartData = localStorage.getItem('chartData');
  if (savedChartData) {
    return JSON.parse(savedChartData); // Parse the saved data
  }
  return { labels: [], data: [] }; // Return empty data if no saved chart data
};

// Initialize chart with data from localStorage (if available)
const chartData = loadChartData();

const dividendChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartData.labels, // Load labels from localStorage
    datasets: [{
      label: 'Total Dividend Payment',
      data: chartData.data, // Load data from localStorage
      borderColor: 'rgba(197,168,0, 1)',
      backgroundColor: 'rgba(197,168,0, 0.2)',
      fill: true,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        display: true
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Date' },
        type: 'time',
        time: {
          unit: 'day'
        }
      },
      y: {
        title: { display: true, text: 'Dividend Payment ($)' },
        beginAtZero: true
      }
    }
  }
});

// Add or update a data point for the current date
const updateChart = () => {
  const today = new Date();
  const localDate = today.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  
  const index = dividendChart.data.labels.indexOf(localDate);

  const roundedTotalDividends = Math.round(totalDividends * 100) / 100;

  if (index !== -1) {
    // Update the Y-axis value for the current date
    dividendChart.data.datasets[0].data[index] = roundedTotalDividends;
  } else {
    // Add a new point for today's date
    dividendChart.data.labels.push(localDate);
    dividendChart.data.datasets[0].data.push(roundedTotalDividends);
  }

  dividendChart.update();
  console.log('Chart Point Set');
};

// Button to set a new data point when clicked
document.getElementById('set-dividend-btn').addEventListener('click', () => {
  updateChart(); // Update the chart with the current total dividends
  saveChartData(); // Save the updated chart data to localStorage
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// STOCK DIVIDEND DETAIL FUNCTIONS


// Fetch detailed stock data
const fetchStockDetails = async () => {
  const tickerInput = document.getElementById('stock-ticker-input');
  const ticker = tickerInput.value.trim().toUpperCase(); // Ensure ticker is uppercase

  if (!ticker) {
    alert('Please enter a stock ticker.');
    return;
  }

  // Set the ticker in the top-left grid cell
  const gridTickerCell = document.querySelector('.stock-details-grid .ticker');
  gridTickerCell.textContent = ticker;

  // Retrieve the portfolio from localStorage
  const portfolio = JSON.parse(localStorage.getItem('portfolio'));

  if (!portfolio) {
    alert('No portfolio found in localStorage.');
    return;
  }

  // Find the stock in the portfolio
  const stock = portfolio.find((stock) => stock.stockName === ticker);

  if (stock) {
    console.log('Stock found in localStorage:', stock);

    // Check if the stock has the new latest/previous structure
    const stockData = JSON.parse(localStorage.getItem('data'))[ticker] || {};
    const latest = stockData.latest || {};
    const previous = stockData.previous || {};

    // Populate the stock details section
    document.getElementById('recentExDividendDate').textContent = formatDate(latest.exDividendDate) || 'N/A';
    document.getElementById('recentDeclarationDate').textContent = formatDate(latest.declarationDate) || 'N/A';
    document.getElementById('recentRecordDate').textContent = formatDate(latest.recordDate) || 'N/A';
    document.getElementById('recentPaymentDate').textContent = formatDate(latest.paymentDate) || 'N/A';
    document.getElementById('recentDividendAmount').textContent = `$${parseFloat(latest.dividend || 0).toFixed(4)}` || '$0.00';

    // Populate previous details
    document.getElementById('previousExDividendDate').textContent = formatDate(previous.exDividendDate) || 'N/A';
    document.getElementById('previousDeclarationDate').textContent = formatDate(previous.declarationDate) || 'N/A';
    document.getElementById('previousRecordDate').textContent = formatDate(previous.recordDate) || 'N/A';
    document.getElementById('previousPaymentDate').textContent = formatDate(previous.paymentDate) || 'N/A';
    document.getElementById('previousDividendAmount').textContent = `$${parseFloat(previous.dividend || 0).toFixed(4)}`;
  } else {
    console.log('Stock not found in portfolio.');

    // Reset the grid when stock isn't found
    gridTickerCell.textContent = ''; // Clear ticker in the top-left grid cell

    // Clear all stock details cells
    const fields = [
      'recentExDividendDate', 'recentDeclarationDate', 'recentRecordDate', 'recentPaymentDate', 'recentDividendAmount',
      'previousExDividendDate', 'previousDeclarationDate', 'previousRecordDate', 'previousPaymentDate', 'previousDividendAmount',
    ];
    fields.forEach((field) => {
      document.getElementById(field).textContent = field.includes('Amount') ? '$0.0000' : 'N/A';
    });

    // Alert the user
    alert('Stock not found in portfolio.');
  }

  // Clear the input field and show the placeholder
  tickerInput.value = '';
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ADD STOCK FUNCTIONS


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MY PORTFOLIO FUNCTIONS

/*
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// API KEY FUNCTIONS


// Add an event listener to the "Set API Key" button
document.getElementById('setApiKeyButton').addEventListener('click', updateApiKeyFromInput);

// Function to update the apiKey when the "Set" button is clicked
function updateApiKeyFromInput() {
  const apiKeyInput = document.getElementById('api-key-input');  // Get the input element
  apiKey = apiKeyInput.value.trim();  // Get the value from the input and set it to apiKey variable
  // Check if the API key is not empty
  if (apiKey !== '') {
    // Save the API key to localStorage
    localStorage.setItem('apiKey', apiKey);

    // Clear the input field
    apiKeyInput.value = '';

    // Show the success alert
    alert('API Key successfully set!');

    console.log('API Key set:', apiKey);  // For debugging, you can see the new API key in the console
  } else {
    // If the input field is empty, show an error alert
    alert('Please enter a valid API Key.');
  }
}

// Function to load API key from localStorage on page load
function loadApiKeyFromLocalStorage() {
  const storedApiKey = localStorage.getItem('apiKey');  // Retrieve the stored API key

  if (storedApiKey) {
      apiKey = storedApiKey;  // Set the apiKey variable to the stored value
      console.log('Loaded API Key from localStorage:', apiKey);  // For debugging
  }
}

// Call the function to load the API key when the page loads
window.onload = loadApiKeyFromLocalStorage;

*/
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// CALENDAR FUNCTIONS


// Call the generateCalendar function when the page loads
document.addEventListener('DOMContentLoaded', generateCalendar);

// Function to get date information
function getDateInfo() {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Get the first and last day of the current month
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0); // Last day of the month
  const totalDays = lastDay.getDate(); // Number of days in the current month
  const firstDayWeekday = firstDay.getDay(); // Day of the week for the first day of the month

  return { currentMonth, currentYear, firstDay, lastDay, totalDays, firstDayWeekday, today };
}

// Function to get portfolio data from localStorage (now from 'data' key)
function getPortfolio() {
  const data = localStorage.getItem("portfolio");  // Retrieve the data from 'data' key
  return data ? JSON.parse(data) : {};  // Parse and return the data, or return an empty object if not found
}

// Function to handle dividend logic
function calculateDividendsMap(currentMonth, currentYear) {
  const dividendsMap = {};
  const portfolio = getPortfolio(); // Retrieve the portfolio from the new location
  currentMonth // 0
  currentYear // 2025

  // Iterate over the keys in the portfolio (the ticker symbols)
  for (const ticker in portfolio) {
    const stock = portfolio[ticker];
    const paymentDateStr = stock.stockPaymentDate; // yyy-mm-dd

    // If there's no payment date, skip this stock
    if (!paymentDateStr) continue;

    const [year, month, day] = paymentDateStr.split('-'); // Extract year, month, and day

    // Create a date object for the payment date
    const paymentDate = new Date(year, month - 1, day); // Correct here

    // Only add dividends for the current month // if logic looks good
    if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
      const paymentDay = paymentDate.getDate(); // Correct day of the month (1-31)
      // paymentDay is correct here
      const totalDividend = ((stock.stockAmount * stock.stockDividend)).toFixed(2); // Use the dividend from the latest data

      // Store the dividend total for the day
      if (dividendsMap[paymentDay]) {
        dividendsMap[paymentDay] = (parseFloat(dividendsMap[paymentDay]) + parseFloat(totalDividend)).toFixed(2);
      } else {
        dividendsMap[paymentDay] = totalDividend;
      }
    }
  }
  // dividendsMap is looking correct here
  return dividendsMap;
}

// Function to generate calendar
function generateCalendar() {
  const { currentMonth, currentYear, totalDays, firstDayWeekday, today } = getDateInfo();
  const calendarContainer = document.getElementById('calendar');
  const monthYearElement = document.getElementById('month-year');
  const totalDividendsElement = document.getElementById('total-month-dividends');

  // Update the month-year text content
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 
    'August', 'September', 'October', 'November', 'December'
  ];
  monthYearElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  
  // Clear previous calendar contents
  calendarContainer.innerHTML = '';

  // Create the days of the week header
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  daysOfWeek.forEach(day => {
    const dayElement = document.createElement('div');
    dayElement.textContent = day;
    calendarContainer.appendChild(dayElement);
    dayElement.classList.add('day-header');
  });

  // Create blank cells for days before the 1st of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    const emptyCell = document.createElement('div');
    calendarContainer.appendChild(emptyCell);
    emptyCell.classList.add('empty-day');
  }

  // Calculate dividends for the current month
  const dividendsMap = calculateDividendsMap(currentMonth, currentYear);

  //----------- Dividend logic is correct up to here

  // Calculate the total dividends for the current month
  let totalDividendsForMonth = 0;
  Object.values(dividendsMap).forEach(dividend => {
    totalDividendsForMonth += parseFloat(dividend);
  });

  // logic is correct to here but total dividend is wrong

  // Update the total dividends display
  totalDividendsElement.textContent = `Estimated Total Dividends: $${totalDividendsForMonth.toFixed(2)}`;

  // Create the days of the month
  for (let day = 1; day <= totalDays; day++) {
    const dayElement = document.createElement('div');
    dayElement.textContent = day;
    dayElement.classList.add('day');
    
    // Highlight today's date
    if (day === today.getDate()) {
      dayElement.classList.add('today');
    }

    // Display the dividend total if it exists for this day
    if (dividendsMap[day]) {
      const dividendTotal = document.createElement('div');
      dividendTotal.classList.add('dividend-total');
      dividendTotal.textContent = `$${dividendsMap[day]}`;
      dayElement.appendChild(dividendTotal);
    }

    // Append the day element to the calendar container
    calendarContainer.appendChild(dayElement);
  }

  // Calculate how many empty cells are needed to complete the last row
  const totalCells = firstDayWeekday + totalDays;  // Total cells in the calendar (including blanks)
  const remainingCells = totalCells % 7;  // Cells remaining after the last day
  const cellsToFill = remainingCells === 0 ? 0 : 7 - remainingCells; // Add empty cells to fill the last row

  // Add empty cells to the last row if necessary
  for (let i = 0; i < cellsToFill; i++) {
    const emptyCell = document.createElement('div');
    calendarContainer.appendChild(emptyCell);
  }

  console.log('Calendar Rendered'); // Console Log Action
}

// Function to highlight the stock row with payment date 2 and 3 months ago
function highlightOldStock() {
  // Get the current date
  const today = new Date();

  // Get the month and year for one months ago
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(today.getMonth() - 1);
  
  // Get the month and year for two months ago
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(today.getMonth() - 2);
  
  // Get the month and year for three months ago
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  // Extract the month values (0-based month: January = 0, December = 11)
  const twoMonthsAgoMonth = twoMonthsAgo.getMonth();
  const threeMonthsAgoMonth = threeMonthsAgo.getMonth();
  const oneMonthAgoMonth = oneMonthAgo.getMonth();

  // Loop through the portfolio and check if the payment date is two or three months ago
  portfolio.forEach((stock, index) => {
    // Parse the payment date (Assuming the format is YYYY-MM-DD)
    const [year, month, day] = stock.stockPaymentDate.split('-');
    const stockMonth = parseInt(month) - 1; // Month is 1-based in the stock data, so subtract 1

    // Compare if the payment date is exactly one months ago
    if (stockMonth === oneMonthAgoMonth) {
      // Find the corresponding row and add a CSS class for highlighting
      const stockRow = document.getElementById(`stock-${index}`); // Find the row by ID
      if (stockRow) {
        stockRow.classList.add('highlight'); // Add the highlight class
      }
    }

    // Compare if the payment date is exactly two months ago
    if (stockMonth === twoMonthsAgoMonth) {
      // Find the corresponding row and add a CSS class for highlighting
      const stockRow = document.getElementById(`stock-${index}`); // Find the row by ID
      if (stockRow) {
        stockRow.classList.add('highlight'); // Add the highlight class
      }
    }

    // Compare if the payment date is exactly three months ago
    if (stockMonth === threeMonthsAgoMonth) {
      // Find the corresponding row and add a CSS class for highlighting
      const stockRow = document.getElementById(`stock-${index}`); // Find the row by ID
      if (stockRow) {
        stockRow.classList.add('highlight'); // Add the highlight class
      }
    }
  });
}

// Function to refresh the calendar
function refreshCalendar() {
  generateCalendar(); // Re-generate the calendar with the updated portfolio
  console.log('Calendar Refreshed'); // Console Log Action
}


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// DIVIDEND HISTORY FUNCTIONS


const historyChart = new Chart(ctx2, {
  type: "line",
  data: {
    labels: placeholderLabels, // Placeholder labels
    datasets: [{
      label: "Data Point",
      data: placeholderData, // Placeholder data
      borderColor: "rgba(197,168,0, 1)",
      backgroundColor: "rgba(197,168,0, 0.2)",
      borderWidth: 2,
      pointRadius: 3,
      fill: true,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        display: true
      }
    },
    scales: {
      x: {
        title: { display: true, text: "Ex-Dividend Date" }
      },
      y: {
        title: { display: true, text: "Dividend Amount" },
        beginAtZero: true
      }
    }
  }
});

// Function to update the chart with real data
document.getElementById("get-dividend-history-btn").addEventListener("click", () => {
  const tickerInputField = document.getElementById("history-ticker-input"); // Input field element
  const tickerInput = document.getElementById("history-ticker-input").value.trim().toUpperCase(); // Get input and convert to uppercase
  const storedHistory = JSON.parse(localStorage.getItem("dividendHistory")) || {}; // Fetch stored history

  if (!storedHistory[tickerInput]) {
    alert("This ticker is not in your portfolio.");
    return;
  }

  const tickerData = storedHistory[tickerInput];
  const amountData = tickerData.Amount;
  const dateData = tickerData.ExDate;

  const dataLength = Object.keys(amountData).length;

  // Extract the dividend amounts and dates for plotting
  const dividendAmounts = [];
  const exDividendDates = [];

  for (let i = 0; i < dataLength; i++) {
    dividendAmounts.push(amountData[i]);
    exDividendDates.push(dateData[i]);
  }

  // Reverse the order of the data and labels
  const reversedAmounts = dividendAmounts.reverse();
  const reversedDates = exDividendDates.reverse();

  // Update the chart with new data
  historyChart.data.labels = exDividendDates; // Use dates as labels
  historyChart.data.datasets[0].data = dividendAmounts; // Use dividend amounts as data
  historyChart.data.datasets[0].label = `${tickerInput} Dividend History`;
  historyChart.update();

  // Clear the input field and show the placeholder
  tickerInputField.value = '';
});