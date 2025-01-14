const form = document.getElementById('stock-form');
const portfolioTable = document.querySelector('#portfolio-table tbody');
const totalPaymentElement = document.getElementById('total-payment');
let portfolio = [];
let totalDividends = 0;
let apiKey = '';
let fetchedDividendData = null; // Store fetched dividend data
const toggleButton = document.getElementById('toggle-api-manual-btn');
let isManualEntry = false; // Track the current mode (false = API, true = Manual)


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MISC FUNCTIONS

const saveTotalDividends = (totalDividends) => {
  // Shared data for growth chart
  localStorage.setItem('sharedData', totalDividends);
};

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
// SAVE, LOAD, AND CLEAR BUTTONS

// Save all local storage data as a single JSON file
document.getElementById('save-all-data-btn').addEventListener('click', () => {
  // Create an object to store all local storage data
  const allData = {};
  const excludedKeys = ["ally-supports-cache"];

  // Loop through all keys in localStorage and add them to the allData object
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    // Skip the keys in the excludedKeys list
    if (excludedKeys.includes(key)) {
      continue;
    }

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
    console.log("This is the file:" + file);
    if (file && file.type === 'application/json') {
      const reader = new FileReader();

      // Read the file as text
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target.result); // Parse the JSON data
          console.log("This is the loadedData after onload:" + loadedData);

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

            // Re-render the portfolio
            renderPortfolio();
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

// Function to clear all localStorage data
document.getElementById('clear-all-data-btn').addEventListener('click', () => {
  const confirmation = confirm('Are you sure you want to clear all local storage data? This action cannot be undone.');

  if (confirmation) {
    localStorage.clear(); // Clear all data from localStorage
    console.log('All local storage data has been cleared.');
    alert('All local storage data has been cleared.');

    // Reset any relevant global variables and UI components
    portfolio = []; // Clear portfolio array
    totalDividends = 0; // Reset total dividends
    renderPortfolio(); // Re-render portfolio to reflect the cleared state
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
      console.warn('Loaded API Key from localStorage:', apiKey);  // For debugging
  }
}

// Call the function to load the API key when the page loads
window.onload = loadApiKeyFromLocalStorage;


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// FETCH TICKER OVERVIEW DATA FUNCTIONS


const fetchOverview = async (ticker) => {
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`;
  try {
    const response = await fetch(url);
    console.warn(`${ticker} overview has been fetched using API key: ${apiKey}`);

    // Check if the response is JSON or plain text
    const data = await response.json().catch(() => null);

    if (!data || data.Information) {
      return null;
    }

    // Ensure the `ticker` is passed and used properly
    if (!ticker) {
      console.error('Ticker is undefined. Please provide a valid ticker symbol.');
      return;
    }

    // Process API response data
    const parsedData = {
      name: data.Name,
      description: data.Description,
      sector: data.Sector,
      marketCap: data.MarketCapitalization,
      peRatio: data.PERatio,
      dividendPerShare: data.DividendPerShare,
      dividendYield: data.DividendYield,
      eps: data.EPS,
      analystTargetPrice: data.AnalystTargetPrice,
      beta: data.Beta,
      yearHigh: data["52WeekHigh"],
      yearLow: data["52WeekLow"],
      fiftyDMA: data["50DayMovingAverage"],
      twoHundredDMA: data["200DayMovingAverage"],
      exDividendDate: data.ExDividendDate,
      dividendDate: data.DividendDate,
    };

    // Save parsedData to local storage function call
    saveOverviewToLocalStorage('overviewData', ticker, parsedData);

  } catch (error) {
    console.error('Error fetching overview data:', error);
  }

  return null;
};

// Function to save parsed data to localStorage
const saveOverviewToLocalStorage = (key, ticker, newData) => {

  if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
    console.error('Invalid ticker provided:', ticker);
    return;
  }

  // Get the existing data from localStorage, or initialize it if not available
  const storedData = JSON.parse(localStorage.getItem(key)) || {};

  // Check if the ticker already exists in localStorage
  if (storedData[ticker]) {
    const storedTickerData = storedData[ticker];

    // Check if the data has changed
    const hasChanges = Object.keys(newData).some(
      (field) => newData[field] !== storedTickerData[field]
    );

    if (!hasChanges) {
      console.log(`${ticker} overview data is already up to date.`);
      return; // Do nothing if there are no changes
    } else {
      console.log(`${ticker} overview data has changed. Updating.`);
    }
  } else {
    console.log(`No overview data found for ${ticker}. Adding overview data.`);
  }

  // Add or update the ticker data in the stored data
  storedData[ticker] = newData;

  // Sort the stored tickers alphabetically by their keys (ticker symbols)
  const sortedStoredData = Object.keys(storedData)
    .sort() // Sort the keys alphabetically
    .reduce((obj, key) => {
      obj[key] = storedData[key]; // Rebuild the object in sorted order
      return obj;
    }, {});

  // Save the updated object back to localStorage
  localStorage.setItem(key, JSON.stringify(sortedStoredData));

  console.log(`Overview data for ${ticker} has been saved to localStorage.`);
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

  // Call function to get company overview
  fetchOverview(stockName);

  console.warn(`Stock added. Company overview data was fetched.`)

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

  console.log(`Latest and previous dividend data for ${stockName} saved to localStorage`);

  // Recalculate total dividends
  totalDividends = portfolio.reduce(
    (total, stock) => total + stock.stockAmount * stock.stockDividend,
    0
  );

  // Re-render the portfolio table
  renderPortfolio();

  // Reset the form and the fetched data
  form.reset();
  fetchedDividendData = null;

  // Disable dividend input and payment date input if in API mode
  if (!isManualEntry) {
    dividendInput.disabled = true;
    dividendInput.placeholder = 'API Fetch';
    paymentDateInput.disabled = true;
    paymentDateInput.placeholder = ' ';
  };

});

// Fetching API data
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
      console.error(`No dividend data found for ${ticker}.`);
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

  // Check if manual entry mode is enabled
  if (isManualEntry) {
    console.log('Manual entry mode is enabled. Skipping API fetch.');
    return; // Exit the function to avoid API calls
  }

  if (ticker) {
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
      console.log('Manual entry mode is enabled.');
    }
  }

  fetchAllDividends(ticker);
});

// Function to capture all dividend history in JSON response
const fetchAllDividends = async (ticker) => {
  const url = `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${ticker}&apikey=${apiKey}`;
  const dividendHistory = []; // Array to store all 'amount' values
  const exDividendDates = []; // Array to store all 'ex_dividend_date' values
  const paymentDate = []; // Array to store 'payment_date' values for the first 8 entries

  try {
    const response = await fetch(url);

    // Check if the response is JSON or plain text
    const data = await response.json().catch(() => null);

    if (!data || data.Information) {
      return null;
    }

    // Loop through the 'data' array and extract the 'amount' and 'ex_dividend_date' from each object
    if (data['data'] && data['data'].length > 0) {
      for (let i = 0; i < data['data'].length; i++) {
        const dividend = data['data'][i]; // Get each dividend object

        // Extract the 'amount' value and 'ex_dividend_date' value
        const amount = parseFloat(dividend['amount']) || 0.0000; // Default to 0 if no amount
        const exDate = dividend['ex_dividend_date'] || "Unknown"; // Default to 'Unknown' if no date

        dividendHistory.push(amount); // Store the amount
        exDividendDates.push(exDate); // Store the ex_dividend_date

        // Extract 'payment_date' for the first 8 indexes
        if (i < 8) {
          const payDate = dividend['payment_date'] || "Unknown"; // Default to 'Unknown' if no payment_date
          paymentDate.push(payDate); // Store the payment_date
        }
      }

      // Now save this dividend history to localStorage
      saveDividendHistoryToLocalStorage(ticker, dividendHistory, exDividendDates, paymentDate);

      return { dividendHistory, exDividendDates, paymentDate }; // Return both arrays
    } else {
      console.error(`No dividend data found for ${ticker}.`);
    }
  } catch (error) {
    console.error('Error fetching dividend data:', error);
  }

  return null;
};

// Function to save the dividend history and ex-dividend dates to localStorage
const saveDividendHistoryToLocalStorage = (ticker, dividendHistory, exDividendDates, paymentDate) => {
  // Get the existing 'dividendHistory' from localStorage, or initialize it if not available
  const storedHistory = JSON.parse(localStorage.getItem('dividendHistory')) || {};

  // Check if the ticker already exists in localStorage
  if (storedHistory[ticker]) {
    const storedTickerData = storedHistory[ticker];

    // Check if the dividend data has changed
    const hasChanges = (
      dividendHistory.length !== Object.keys(storedTickerData.Amount || {}).length ||
      exDividendDates.length !== Object.keys(storedTickerData.ExDate || {}).length ||
      paymentDate.length !== Object.keys(storedTickerData.PaymentDate || {}).length ||
      dividendHistory.some((value, index) => value !== storedTickerData.Amount[index]) ||
      exDividendDates.some((value, index) => value !== storedTickerData.ExDate[index]) ||
      paymentDate.some((value, index) => value !== storedTickerData.PaymentDate[index])
    );

    if (!hasChanges) {
      console.log(`Dividend history for ${ticker} is already up to date.`);
      return; // Do nothing if there are no changes
    } else {
      console.log(`Dividend history for ${ticker} has changed. Updating.`);
    }
  } else {
    console.log(`No dividend history found for ${ticker}. Adding history data.`);
  }

  // Create a new object for the ticker with both 'Amount' and 'ExDate' keys
  const tickerHistory = {
    Amount: {},
    ExDate: {},
    PaymentDate: {}
  };

  for (let i = 0; i < dividendHistory.length; i++) {
    tickerHistory.Amount[i] = dividendHistory[i];
    tickerHistory.ExDate[i] = exDividendDates[i];
    if (i < paymentDate.length) {
      tickerHistory.PaymentDate[i] = paymentDate[i];
    }
  }

  // Add or update the ticker data in the stored history
  storedHistory[ticker] = tickerHistory;

  // Sort the stored tickers alphabetically by their keys (ticker symbols)
  const sortedStoredHistory = Object.keys(storedHistory)
    .sort() // Sort the keys alphabetically
    .reduce((obj, key) => {
      obj[key] = storedHistory[key]; // Rebuild the object in sorted order
      return obj;
    }, {});

  // Save the updated 'dividendHistory' object back to localStorage
  localStorage.setItem('dividendHistory', JSON.stringify(sortedStoredHistory));

  console.log(`Dividend history for ${ticker} has been saved to localStorage.`);
};


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MY PORTFOLIO FUNCTIONS


// Function to display data on stcok
const displayStockData = (stockName) => {
  // Fetch data from localStorage
  const overviewData = JSON.parse(localStorage.getItem('overviewData')) || {};
  const stockData = overviewData[stockName];

  if (!stockData) {
    alert(`Overview data not stored for ${stockName} yet. Try refetching to pull new data.`);
    return;
  }

  // Create or show a pop-up/modal
  const popup = document.createElement('div');
  popup.id = 'stock-popup';

  // Disable page scrolling
  document.body.classList.add('no-scroll');

  popup.innerHTML = `
  
    <div id="overview-top">
      <h1>${stockName}</h1>
      <button onclick="closePopup()">Close</button>
    </div>

    <div id="overview-header" class="module-styling">
      <h2>${stockData.name || stockName}</h2>
      <p>${stockData.sector || 'N/A'}</p>
    </div>

    <div id="overview-description" class="module-styling">
      <p>${stockData.description || 'N/A'}</p>
    </div>

    <div id="overview-details" class="module-styling">
      <p><strong>Market Cap:</strong> ${stockData.marketCap ? '$' + Number(stockData.marketCap).toLocaleString() : 'N/A'}</p>
      <p><strong>Analyst Target Price:</strong> $${stockData.analystTargetPrice !== undefined && !isNaN(stockData.analystTargetPrice) ? parseFloat(stockData.analystTargetPrice).toFixed(2) : 'N/A'}</p>
      <p><strong>Beta:</strong> ${stockData.beta || 'N/A'}</p>
    </div>

    <div id="overview-dividend" class="module-styling">
      <p><strong>Annual Dividend Per Share:</strong>$${stockData.dividendPerShare !== undefined && !isNaN(stockData.dividendPerShare) ? parseFloat(stockData.dividendPerShare).toFixed(2) : 'N/A'}</p>
      <p><strong>Dividend Yield:</strong> ${stockData.dividendYield ? (stockData.dividendYield * 100).toFixed(2) : 'N/A'}%</p>
    </div>

    <div id="overview-financials" class="module-styling">
      <p><strong>Earnings Per Share:</strong> $${stockData.eps !== undefined && !isNaN(stockData.eps) ? parseFloat(stockData.eps).toFixed(2) : 'N/A'}</p>
      <p><strong>Price/Earnings Ratio:</strong> ${stockData.peRatio || 'N/A'}</p>
    </div>

    <div id="overview-averages" class="module-styling">
      <p><strong>50 Day Moving Average:</strong> $${stockData.fiftyDMA !== undefined && !isNaN(stockData.fiftyDMA) ? parseFloat(stockData.fiftyDMA).toFixed(2) : 'N/A'}</p>
      <p><strong>200 Day Moving Average:</strong> $${stockData.twoHundredDMA !== undefined && !isNaN(stockData.twoHundredDMA) ? parseFloat(stockData.twoHundredDMA).toFixed(2) : 'N/A'}</p>
    </div>

    <div id="overview-highlow" class="module-styling">
      <p><strong>52 Week High:</strong> $${stockData.yearHigh !== undefined && !isNaN(stockData.yearHigh) ? parseFloat(stockData.yearHigh).toFixed(2) : 'N/A'}</p>
      <p><strong>52 Week Low:</strong> $${stockData.yearLow !== undefined && !isNaN(stockData.yearLow) ? parseFloat(stockData.yearLow).toFixed(2) : 'N/A'}</p>
    </div>
  `;

  document.body.appendChild(popup);
};

// Function to close data popup
const closePopup = () => {
  const popup = document.getElementById('stock-popup');
  // Enable page scrolling
  document.body.classList.remove('no-scroll');
  if (popup) popup.remove();
};

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
      <td id="${stock.stockName}" class="stock-name-cell">${stock.stockName}</td>
      <td contenteditable="true" onblur="updateStock(${index}, 'amount', this.textContent)">${parseFloat(stock.stockAmount).toFixed(4)}</td> <!-- Ensure 4 decimal places -->
      <td contenteditable="true" onblur="updateStock(${index}, 'dividend', this.textContent)">${parseFloat(stock.stockDividend).toFixed(4)}</td> <!-- Display dividend with 4 decimals -->
      <td id="full-dividend-${index}">$${fullDividend}</td> <!-- Display full dividend -->
      <td id="dividend-date" onblur="updateStock(${index}, 'paymentDate', this.textContent)">${formattedDate}</td>
      <td><button id="refetch-btn-${index}" class="portfolio-refetch-btn" data-index="${index}"  onclick="refetchDividend(${index})"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg></button></td> <!-- Refetch button -->
      <td><button onclick="removeStock(${index})" class="portfolio-rm-btn" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg></button></td>
    `;
    portfolioTable.appendChild(row);
    // Add a click event listener to the stock name cell
    row.querySelector('.stock-name-cell').addEventListener('click', () => displayStockData(stock.stockName));
  });
  console.log('Table Rendered'); // Console Log Action

  totalPaymentElement.textContent = totalDividends.toFixed(2);
  saveTotalDividends(totalDividends.toFixed(2));

  // Save portfolio to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  console.log('Portfolio Saved to Local Storage'); // Console Log Action

  // Highlight row with payment date two months ago
  highlightOldStock();
  console.log('Old Rows Highlighted'); // Console Log Action
};

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
    console.error(`Ticker ${stock.stockName} not found in 'data' object.`);
  }

  // Recalculate the full dividend for the stock
  totalDividends += stock.stockAmount * stock.stockDividend;

  console.log("Stock value manually updated.");
  renderPortfolio();
};

// Remove stock from portfolio, dividendHistory, and data objects
window.removeStock = (index) => {
  const stock = portfolio.splice(index, 1)[0];
  totalDividends -= stock.stockAmount * stock.stockDividend;

  // Remove the corresponding entry from the 'data' object in localStorage
  let existingData = JSON.parse(localStorage.getItem('data')) || {};
  // Delete the stock data by ticker symbol
  delete existingData[stock.stockName];
  // Save the updated 'data' object back to localStorage
  localStorage.setItem('data', JSON.stringify(existingData));

  // Remove the corresponding entry from the 'dividendHistory' object in localStorage
  let existingData2 = JSON.parse(localStorage.getItem('dividendHistory')) || {};
  // Delete the stock data by ticker symbol
  delete existingData2[stock.stockName];
  // Save the updated 'dividendHistory' object back to localStorage
  localStorage.setItem('dividendHistory', JSON.stringify(existingData2));

  // Remove the corresponding entry from the 'overviewData' object in localStorage
  let existingData3 = JSON.parse(localStorage.getItem('overviewData')) || {};
  // Delete the stock data by ticker symbol
  delete existingData3[stock.stockName];
  // Save the updated 'overviewData' object back to localStorage
  localStorage.setItem('overviewData', JSON.stringify(existingData3));

  console.log(`${stock.stockName} has been removed.`)

  // Re-render the portfolio table
  renderPortfolio();
};

// Refetch dividend
window.refetchDividend = async (index) => {
  const stock = portfolio[index];
  const button = document.getElementById(`refetch-btn-${index}`);
  const ticker = stock.stockName;

  // Update button text to indicate fetching
  button.textContent = 'Refetching...';

  try {
    // Fetch new dividend data
    const dividendData = await fetchDividend(ticker);

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
    existingData[ticker] = formattedData;

    // Sort the keys alphabetically and rebuild the existingData object
    const sortedData = Object.keys(existingData)
    .sort()  // Sort keys alphabetically
    .reduce((obj, key) => {
      obj[key] = existingData[key];  // Rebuild the object in sorted order
      return obj;
    }, {});

    // Save the updated 'data' object to localStorage
    localStorage.setItem('data', JSON.stringify(sortedData));
    console.log(`Latest and previous dividend data for ${ticker} saved to localStorage`);

    // Update portfolio with new values
    portfolio[index] = {
      stockName: ticker,
      stockAmount: stock.stockAmount,
      stockDividend: latest.dividend,
      stockPaymentDate: latest.paymentDate,
    };

    // Recalculate total dividends
    totalDividends = portfolio.reduce(
      (total, stock) => total + stock.stockAmount * stock.stockDividend,
      0
    );

    // Confirm data was refetched
    console.warn(`Refetched data for ticker: ${ticker}`);

    // Re-render the portfolio table
    renderPortfolio();

  } catch (error) {
    console.error(`Error refetching dividend for ${ticker}:`, error);
  } finally {
    // Reset button text after operation
    button.textContent = 'Refetch';
  }

  // Call function to get full dividend amount history
  fetchAllDividends(ticker);
  console.error("Remember to move this fetchAllDividends function back in the below if statement after all tickers have PaymentDate under dividendHistory local storage")

  if (shouldFetch(ticker)) {
    
    // Call function to get company overview
    fetchOverview(ticker);
    console.warn("All dividend data and overview data was fetched because payment date changed.");

  } else {
    console.log("All dividend and overview data wasn't fetched because the payment date hasn't changed.");
  }

  // Resave Stock to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
};

// Load portfolio from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  const savedPortfolio = localStorage.getItem('portfolio');
  if (savedPortfolio) {
    portfolio = JSON.parse(savedPortfolio);
    totalDividends = portfolio.reduce((total, stock) => total + stock.stockAmount * stock.stockDividend, 0);
    renderPortfolio();
  }
});

// Function to check if should run subsequent fetch
const shouldFetch = (ticker) => {
  const overview = JSON.parse(localStorage.getItem('overviewData')) || {};
  const dividend = JSON.parse(localStorage.getItem('data')) || {};

  // Check if ticker data exists in both sources
  if (!overview[ticker] || !dividend[ticker]) {
    console.error(`Data for ticker ${ticker} is missing in one or both local storage keys, overviewData or data.`);
    return true; // Fetch is required if data is incomplete
  }

  const overviewPayDate = overview[ticker].dividendDate;
  const divPayDate = dividend[ticker].latest.paymentDate;

  // Check if the latest payment date exists
  if (!divPayDate) {
    console.error(`Latest payment date is missing for ticker ${ticker}.`);
    return true; // Fetch if the latest payment date is missing
  }

  // If overviewPayDate is missing or doesn't match divPayDate, fetch is needed
  if (overviewPayDate !== divPayDate) {
    console.error(
      `Payment dates mismatch for ticker ${ticker}. Overview date: ${overviewPayDate}, Dividend date: ${divPayDate}.`
    );
    return true;
  }

  // Dates match; no need to fetch
  return false;
};
