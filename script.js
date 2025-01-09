const form = document.getElementById('stock-form');
const portfolioTable = document.querySelector('#portfolio-table tbody');
const totalPaymentElement = document.getElementById('total-payment');
const ctx = document.getElementById('dividend-chart').getContext('2d');

let portfolio = [];
let totalDividends = 0;
let apiKey = '';
let fetchedDividendData = null; // Store fetched dividend data
const toggleButton = document.getElementById('toggle-api-manual-btn');
let isManualEntry = false; // Track the current mode (false = API, true = Manual)



// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A'; // Handle empty or invalid dates
  
  // Manually create a date object by parsing the date string
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day); // month is 0-indexed

  if (isNaN(date.getTime())) return 'N/A'; // Handle invalid date formats

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

function zFold() {
  const currentWidth = window.innerWidth;
  const verticalClosed = 344;
  const landscapeClosed = 882;
  const verticalOpen = 690;
  const landscapeOpen = 829;

  // Select the body element
  const body = document.querySelector("body");
  const header = document.querySelector("header");
  const main = document.querySelector("main");
  
  if (currentWidth === verticalClosed || currentWidth === landscapeClosed) {
      body.setAttribute("id", "zFold");
      body.removeChild(header);
      body.removeChild(main);

      const text = document.createElement("h1");
      text.textContent = "Get and iPhone B===D";
      body.appendChild(text);
  }

  if (currentWidth === verticalOpen || currentWidth === landscapeOpen) {
    body.setAttribute("id", "zFold");
    body.removeChild(header);
    body.removeChild(main);

    const text = document.createElement("h1");
    text.textContent = "Close your phone and get and iPhone B===D";
    body.appendChild(text);
  }
}

zFold();


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
            renderPortfolio();
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
      borderColor: '#C5A800',
      backgroundColor: '#C5A800',
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

// Save chart data to localStorage
const saveChartData = () => {
  const chartData = {
    labels: dividendChart.data.labels,
    data: dividendChart.data.datasets[0].data
  };
  localStorage.setItem('chartData', JSON.stringify(chartData));
  alert('Dividend Point Set.')
};

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

// Clear chart data from localStorage
const clearChartData = () => {
  localStorage.removeItem('chartData'); // Remove the 'chartData' from localStorage
  console.log('Chart data cleared from localStorage');

  // Optionally, clear the chart data in memory and reset the chart
  dividendChart.data.labels = [];
  dividendChart.data.datasets[0].data = [];
  dividendChart.update(); // Update the chart to reflect the deletion
};

// Button to clear chart data from localStorage
document.getElementById('clear-chart-btn').addEventListener('click', () => {
  clearChartData(); // Clear the chart data from localStorage
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// STOCK DIVIDEND DETAIL FUNCTIONS


// Function to clear the stock data from localStorage
const clearStockData = () => {
  // Remove the 'data' object from localStorage
  localStorage.removeItem('data');
};

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

// Ensure the disabled state and placeholder are set correctly on page load
document.addEventListener('DOMContentLoaded', () => {
  const dividendInput = document.getElementById('stock-dividend');
  const paymentDateInput = document.getElementById('stock-payment-date');  // Get payment date input field

  // Initial state
  if (!dividendInput.value || dividendInput.value === '0.000') {
    dividendInput.disabled = true;
    dividendInput.placeholder = 'API Fetch';
    paymentDateInput.disabled = true;  // Disable payment date field initially
    paymentDateInput.placeholder = ' ';
  } else {
    dividendInput.disabled = true;
    dividendInput.placeholder = ''; // Clear placeholder if value exists
    paymentDateInput.disabled = true;  // Disable payment date field if value exists
    paymentDateInput.placeholder = ''; // Clear placeholder if value exists
  }
});

// Button to toggle between API and manual entry
toggleButton.addEventListener('click', () => {
  const dividendInput = document.getElementById('stock-dividend');
  const paymentDateInput = document.getElementById('stock-payment-date');
  
  // Toggle between manual entry and API
  isManualEntry = !isManualEntry;

  if (isManualEntry) {
    dividendInput.disabled = false;
    dividendInput.placeholder = 'Enter Dividend:';
    paymentDateInput.disabled = false;
    paymentDateInput.placeholder = 'Enter Payment Date:';
    toggleButton.textContent = 'Switch to API Fetch';
  } else {
    dividendInput.disabled = true;
    dividendInput.placeholder = 'API Fetch';
    paymentDateInput.disabled = true;
    paymentDateInput.placeholder = ' ';
    toggleButton.textContent = 'Switch to Manual Entry';
  }
});

// Add stock to portfolio
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const stockName = document.getElementById('stock-name').value.toUpperCase();
  let stockAmount = parseFloat(document.getElementById('stock-amount').value);
  const dividendInput = document.getElementById('stock-dividend');
  const paymentDateInput = document.getElementById('stock-payment-date');

  // Validate inputs
  if (!stockAmount || isNaN(stockAmount)) {
    alert('Please enter a valid amount.');
    return;
  }

  if (!dividendInput.value || parseFloat(dividendInput.value) === 0) {
    alert('Please provide a valid dividend value.');
    return;
  }

  // Ensure stock amount and dividend are converted to 4 decimal places
  stockAmount = stockAmount.toFixed(4);
  const stockDividend = parseFloat(dividendInput.value).toFixed(4);
  const stockPaymentDate = paymentDateInput.value || 'N/A';

  // Add the stock to the portfolio
  portfolio.push({
    stockName,
    stockAmount: parseFloat(stockAmount), // Ensure it's stored as a number
    stockDividend: parseFloat(stockDividend),
    stockPaymentDate,
  });

  // Save portfolio to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));

  // Create the new entry in the 'data' localStorage object for the entered stock
  const newStockData = {
    latest: {
      exDividendDate: 'N/A',
      declarationDate: 'N/A',
      recordDate: 'N/A',
      paymentDate: stockPaymentDate,
      dividend: stockDividend,
    },
    previous: {
      exDividendDate: 'N/A',
      declarationDate: 'N/A',
      recordDate: 'N/A',
      paymentDate: 'N/A',
      dividend: 0.0000,
    },
  };

  // Get existing data from localStorage or initialize it
  let existingData = JSON.parse(localStorage.getItem('data')) || {};

  // Add the new stock to the 'data' object
  existingData[stockName] = newStockData;

  // Sort 'data' alphabetically by stock name
  const sortedData = Object.keys(existingData)
    .sort()
    .reduce((obj, key) => {
      obj[key] = existingData[key];
      return obj;
    }, {});

  // Save the sorted 'data' object to localStorage
  localStorage.setItem('data', JSON.stringify(sortedData));

  console.log(`Dividend data for ${stockName} saved to localStorage`);

  // Recalculate total dividends
  totalDividends = portfolio.reduce(
    (total, stock) => total + stock.stockAmount * stock.stockDividend,
    0
  );

  // Re-render the portfolio table and update the chart
  renderPortfolio();
  updateChart();

  // Reset the form and the fetched data
  form.reset();
  fetchedDividendData = null;

  // Refresh the calendar
  refreshCalendar();
});

// Fetch API data
const fetchDividend = async (ticker) => {
  const url = `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${ticker}&apikey=${apiKey}`;
  try {
    const response = await fetch(url);
    console.log(`${ticker} has been fetched using API key: ${apiKey}`);

    // Check if the response is JSON or plain text
    const data = await response.json().catch(() => null);

    if (!data || data.Information) {
      console.warn('API Rate Limit reached or Error:', data ? data.Information : 'Unknown Error');
      alert('API rate limit reached. Please try again later or upgrade to a premium plan.');
      return null;
    }

    if (data['data'] && data['data'].length > 0) {
      const latestDividend = data['data'][0];
      const previousDividend = data['data'][1] || {};

      return {
        latest: {
          exDividendDate: latestDividend['ex_dividend_date'] || 'N/A',
          declarationDate: latestDividend['declaration_date'] || 'N/A',
          recordDate: latestDividend['record_date'] || 'N/A',
          paymentDate: latestDividend['payment_date'] || 'N/A',
          dividend: parseFloat(latestDividend['amount']) || 0.0000,
        },
        previous: {
          exDividendDate: previousDividend['ex_dividend_date'] || 'N/A',
          declarationDate: previousDividend['declaration_date'] || 'N/A',
          recordDate: previousDividend['record_date'] || 'N/A',
          paymentDate: previousDividend['payment_date'] || 'N/A',
          dividend: parseFloat(previousDividend['amount']) || 0.0000,
        },
      };
    } else {
      console.warn(`No dividend data found for ${ticker}.`);
    }
  } catch (error) {
    console.error('Error fetching dividend data:', error);
  }

  return null;
};

// Event listener to fetch dividend when stock ticker is entered
document.getElementById('stock-name').addEventListener('blur', async (e) => {
  const ticker = e.target.value.toUpperCase();
  const dividendInput = document.getElementById('stock-dividend');
  const paymentDateInput = document.getElementById('stock-payment-date');

  fetchedDividendData = null; // Reset fetched data

  if (ticker && !isManualEntry) {
    dividendInput.disabled = true;
    dividendInput.placeholder = 'Fetching...';

    const dividendData = await fetchDividend(ticker);

    if (dividendData) {
      fetchedDividendData = dividendData;

      // Populate fields with fetched data
      dividendInput.value = dividendData.latest.dividend.toFixed(4);
      paymentDateInput.value = dividendData.latest.paymentDate;
      dividendInput.disabled = true;
      paymentDateInput.disabled = true;
      dividendInput.placeholder = '';
      paymentDateInput.placeholder = '';
    } else {
      // Enable manual entry if no data is fetched
      dividendInput.disabled = false;
      dividendInput.placeholder = 'Enter Dividend:';
      paymentDateInput.disabled = false;
      paymentDateInput.placeholder = ' ';
    }
  }
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MY PORTFOLIO FUNCTIONS

// Clear portfolio button
document.getElementById('clear-portfolio-btn').addEventListener('click', () => {
  // Clear the portfolio array and localStorage
  portfolio = [];
  localStorage.removeItem('portfolio');
  localStorage.removeItem('data');  // This line clears the 'data' object as well, if necessary
  
  // Reset totalDividends value to 0
  totalDividends = 0;

  // Re-render the table and update total dividends and chart
  renderPortfolio();
  updateChart();

  // Refresh the calendar to reflect the new stock's dividend data
  refreshCalendar();
});

// Render portfolio table
const renderPortfolio = () => {
  // Sort portfolio by stock name alphabetically
  portfolio.sort((a, b) => a.stockName.localeCompare(b.stockName));
  portfolioTable.innerHTML = '';
  portfolio.forEach((stock, index) => {
    // Ensure stockAmount and stockDividend are floats
    stock.stockAmount = parseFloat(stock.stockAmount) || 0; // Default to 0 if invalid
    stock.stockDividend = parseFloat(stock.stockDividend) || 0; // Default to 0 if invalid
    const fullDividend = (stock.stockAmount * stock.stockDividend).toFixed(2); // Calculate full dividend
    const formattedDate = formatDate(stock.stockPaymentDate); // Format the payment date
    const row = document.createElement('tr');
    row.id = `stock-${index}`;  // Add a unique ID to each row
    row.innerHTML = `
      <td>${stock.stockName}</td>
      <td contenteditable="true" onblur="updateStock(${index}, 'amount', this.textContent)">${parseFloat(stock.stockAmount).toFixed(4)}</td> <!-- Ensure 4 decimal places -->
      <td contenteditable="true" onblur="updateStock(${index}, 'dividend', this.textContent)">${parseFloat(stock.stockDividend).toFixed(4)}</td> <!-- Display dividend with 4 decimals -->
      <td id="full-dividend-${index}">$${fullDividend}</td> <!-- Display full dividend -->
      <td id="dividend-date" onblur="updateStock(${index}, 'paymentDate', this.textContent)">${formattedDate}</td>
      <td><button id="refetch-btn-${index}" class="portfolio-refetch-btn" data-index="${index}"  onclick="refetchDividend(${index})"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg></button></td> <!-- Refetch button -->
      <td><button onclick="removeStock(${index})" class="portfolio-rm-btn" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg></button></td>
    `;
    portfolioTable.appendChild(row);
  });
  console.log('Table Rendered'); // Console Log Action

  totalPaymentElement.textContent = totalDividends.toFixed(2);

  // Save portfolio to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  console.log('Portfolio Saved to Local Storage'); // Console Log Action

  // Highlight row with payment date two months ago
  highlightOldStock();
  console.log('Old Row Highlighted'); // Console Log Action
};

// Update stock details
window.updateStock = (index, field, value) => {
  // Ensure value is valid number before attempting to parse and apply
  if (field === 'amount') {
    value = parseFloat(value);
    if (isNaN(value)) {
      alert('Invalid input for ' + field);
      return; // Exit early if value is not a valid number
    }
    value = value.toFixed(4); // Only apply .toFixed(4) for numeric fields
  }

  if (field === 'dividend') {
    value = parseFloat(value);
    if (isNaN(value)) {
      alert('Invalid input for ' + field);
      return; // Exit early if value is not a valid number
    }
    value = value.toFixed(4); // Only apply .toFixed(4) for numeric fields
  }

  const stock = portfolio[index];

  if (field === 'amount') {
    totalDividends -= stock.stockAmount * stock.stockDividend;  // Remove old value
    stock.stockAmount = value;
  } else if (field === 'dividend') {
    totalDividends -= stock.stockAmount * stock.stockDividend;  // Remove old value
    stock.stockDividend = value;
  }

  // Update the 'data' object in localStorage
  let data = JSON.parse(localStorage.getItem('data')) || {};
  if (data[stock.stockName]) {
    data[stock.stockName].latest.dividend = value; // Update the dividend
    localStorage.setItem('data', JSON.stringify(data)); // Save the updated data back to localStorage
    console.log(`Updated dividend for ${stock.stockName} in 'data' object.`);
  } else {
    console.warn(`Ticker ${stock.stockName} not found in 'data' object.`);
  }

  // Recalculate the full dividend for the stock
  totalDividends += stock.stockAmount * stock.stockDividend;

  renderPortfolio();
  updateChart();
  // Refresh the calendar to reflect the new stock's dividend data
  refreshCalendar();
};

// Remove stock from portfolio and data object
window.removeStock = (index) => {
  const stock = portfolio.splice(index, 1)[0];
  totalDividends -= stock.stockAmount * stock.stockDividend;

  // Remove the corresponding entry from the 'data' object in localStorage
  let existingData = JSON.parse(localStorage.getItem('data')) || {};
  
  // Delete the stock data by ticker symbol
  delete existingData[stock.stockName];

  // Save the updated 'data' object back to localStorage
  localStorage.setItem('data', JSON.stringify(existingData));

  // Re-render the portfolio table and update the chart
  renderPortfolio();
  updateChart();

  // Refresh the calendar to reflect the removed stock's dividend data
  refreshCalendar();
};

// Refetch dividend
window.refetchDividend = async (index) => {
  const stock = portfolio[index];
  const button = document.getElementById(`refetch-btn-${index}`);

  // Update button text to indicate fetching
  button.textContent = 'Refetching...';

  try {
    // Fetch new dividend data
    const dividendData = await fetchDividend(stock.stockName);

    // Create default "latest" and "previous" objects
    const latest = {
      exDividendDate: "N/A",
      declarationDate: "N/A",
      recordDate: "N/A",
      paymentDate: stock.stockPaymentDate || "N/A", // Use the existing payment date if available
      dividend: stock.stockDividend || 0.0000, // Use the existing dividend if available
    };

    const previous = {
      exDividendDate: "N/A",
      declarationDate: "N/A",
      recordDate: "N/A",
      paymentDate: "N/A", // Default previous payment date to "N/A"
      dividend: 0.0000, // Default previous dividend to 0
    };

    // Check if fetched data is valid and update the "latest" data
    if (dividendData && dividendData.latest) {
      const { latest: fetchedLatest, previous: fetchedPrevious } = dividendData;

      // If fetched data exists, update "latest" and "previous" objects
      if (fetchedLatest) {
        latest.exDividendDate = fetchedLatest.exDividendDate || "N/A";
        latest.declarationDate = fetchedLatest.declarationDate || "N/A";
        latest.recordDate = fetchedLatest.recordDate || "N/A";
        latest.paymentDate = fetchedLatest.paymentDate || latest.paymentDate; // Use fetched if available
        latest.dividend = fetchedLatest.dividend || latest.dividend; // Use fetched if available
      }

      if (fetchedPrevious) {
        previous.exDividendDate = fetchedPrevious.exDividendDate || "N/A";
        previous.declarationDate = fetchedPrevious.declarationDate || "N/A";
        previous.recordDate = fetchedPrevious.recordDate || "N/A";
        previous.paymentDate = fetchedPrevious.paymentDate || "N/A";
        previous.dividend = fetchedPrevious.dividend || 0.0000;
      }
    }

    // Create the ticker object with the latest and previous data
    const formattedData = {
      latest,
      previous
    };

    // Get existing data from localStorage
    let existingData = JSON.parse(localStorage.getItem('data'));

    // Update the data with the new or updated stock
    existingData[stock.stockName] = formattedData;

    // Sort the keys alphabetically and rebuild the existingData object
    const sortedData = Object.keys(existingData)
    .sort()  // Sort keys alphabetically
    .reduce((obj, key) => {
      obj[key] = existingData[key];  // Rebuild the object in sorted order
      return obj;
    }, {});

    // Save the updated 'data' object to localStorage
    localStorage.setItem('data', JSON.stringify(sortedData));
    console.log(`Dividend data for ${stock.stockName} saved to localStorage`);
    console.log(`Refetched data for ticker: ${stock.stockName}`);

    // Update portfolio with new values
    portfolio[index] = {
      stockName: stock.stockName,
      stockAmount: stock.stockAmount,
      stockDividend: latest.dividend,
      stockPaymentDate: latest.paymentDate,
    };

    // Recalculate total dividends
    totalDividends = portfolio.reduce(
      (total, stock) => total + stock.stockAmount * stock.stockDividend,
      0
    );

    // Re-render the portfolio table and update the chart
    renderPortfolio();
    updateChart();

  } catch (error) {
    console.error(`Error refetching dividend for ${stock.stockName}:`, error);
  } finally {
    // Reset button text after operation
    button.textContent = 'Refetch';
  }

  // Resave Stock to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  console.log('Stock Saved to Local Storage'); // Console Log Action

  // Refresh the calendar to reflect the new stock's dividend data
  refreshCalendar();
};

// Load portfolio from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  const savedPortfolio = localStorage.getItem('portfolio');
  if (savedPortfolio) {
    portfolio = JSON.parse(savedPortfolio);
    totalDividends = portfolio.reduce((total, stock) => total + stock.stockAmount * stock.stockDividend, 0);
    renderPortfolio();
    updateChart();
  }
});


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
  
  // Get the month and year for two months ago
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(today.getMonth() - 2);
  
  // Get the month and year for three months ago
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  // Extract the month values (0-based month: January = 0, December = 11)
  const twoMonthsAgoMonth = twoMonthsAgo.getMonth();
  const threeMonthsAgoMonth = threeMonthsAgo.getMonth();

  // Loop through the portfolio and check if the payment date is two or three months ago
  portfolio.forEach((stock, index) => {
    // Parse the payment date (Assuming the format is YYYY-MM-DD)
    const [year, month, day] = stock.stockPaymentDate.split('-');
    const stockMonth = parseInt(month) - 1; // Month is 1-based in the stock data, so subtract 1

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