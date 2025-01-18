const form = document.getElementById('stock-form');
const portfolioTable = document.querySelector('#portfolio-table tbody');
const totalPaymentElement = document.getElementById('total-payment');
let portfolio = [];
let apiKey = '';
let fetchedDividendData = null; // Store fetched dividend data
const toggleButton = document.getElementById('toggle-api-manual-btn');
let isManualEntry = false; // Track the current mode (false = API, true = Manual)
let dataFetchFailed = false;

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MISC FUNCTIONS

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A'; // Handle empty or invalid dates
  
  // Manually create a date object by parsing the date string
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day); // month is 0-indexed

  if (isNaN(date.getTime())) return 'N/A'; // Handle invalid date formats

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Function to get data from local storage with passed key
function getDataFromLocalStorage(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : {};
}

// Function to calculate annual dividend based on dividend per share
function calcAnnualDivs(ticker) {
  const portfolio = getDataFromLocalStorage("portfolio");
  const portfolioAmounts = [];
  const overview = getDataFromLocalStorage("overviewData");
  let overviewDPS;
  const history = getDataFromLocalStorage('dividendHistory');
  if (overview && overview[ticker]) {
    overviewDPS = overview[ticker].dividendPerShare;
  } else {
    overviewDPS = 0;
  }
  let estimateDivPerShare;
  let divPerShare;
  let fourQuarterAmount = 0;
  // Check if the ticker exists in the overview or is an empty object
  if (!overview || overviewDPS == 0 || Object.keys(overview[ticker]).length === 0) {
    const stock = history[ticker];
    if (!stock || !stock["Amount"]) {
      alert(`No dividend history found for ${ticker}.`);
      return;
    }
    const quarterAmounts = stock['Amount']
    const numEntries = Object.keys(quarterAmounts).length;
    if ( overviewDPS === 0 && numEntries === 1 ) {
      const onlyDiv = quarterAmounts[0];
      if (isNaN(onlyDiv)) {
        alert(`Invalid dividend amount for ${ticker}`);
        return;
      }
      fourQuarterAmount = onlyDiv * 4
    } else if  (overviewDPS !== 0 ) {
      if (quarterAmounts.length < 4) {
        alert(`Insufficient data to estimate the annual dividend for ${ticker}.`);
        return;
      }
      fourQuarterAmount = 0;
      // Gets last 4 dividends to calculate estimated annual dividend per share
      for (let i = 0; i < 4; i++) {
        if (isNaN(quarterAmounts[i])) {
          alert(`Invalid dividend amount at index ${i} for ${ticker}`);
          return;
        }
        fourQuarterAmount += quarterAmounts[i];
      }
    }
    if ( ticker == 'BND' || ticker == 'JEPI') {
      if (numEntries === 1) {
        fourQuarterAmount = 0;
        const onlyDiv = quarterAmounts[0];
        fourQuarterAmount = onlyDiv * 12
      } else {
        fourQuarterAmount = 0;
        for (let i = 0; i < 6; i++) {
          if (isNaN(quarterAmounts[i])) {
            alert(`Invalid dividend amount at index ${i} for ${quarterAmounts}`);
            return;
          }
          fourQuarterAmount += quarterAmounts[i];
        }
        fourQuarterAmount *= 2;
      }      
    }
    estimateDivPerShare = fourQuarterAmount.toFixed(4);
    divPerShare = estimateDivPerShare; // Assign the fallback estimate
  } else {
    divPerShare = overviewDPS;
  }
  // Gets the amount owned for all portfolio stocks  
  for (const stock of portfolio) {
    const symbol = stock.stockName;
    const amtOwned = stock.stockAmount;
    // Push the key-value pair as an object to the portfolioAmounts list
    portfolioAmounts.push({ [symbol]: amtOwned });
  }
  // Check if the ticker exists in portfolioAmounts
  const isTickerInPortfolio = portfolioAmounts.some(
    entry => Object.keys(entry).includes(ticker)
  );
  if (isTickerInPortfolio) {
    // Perform desired calculations
    const stock = portfolio.find(stock => stock.stockName === ticker);
    if (stock) {
      annualDiv = (stock.stockAmount * divPerShare).toFixed(2);
      console.log(`CalcAnnualDivs(): Annual dividend for ${ticker}: $${annualDiv}`);
      // Get the existing annual dividends from localStorage or initialize an empty object
      const storedAnnualDividends = JSON.parse(localStorage.getItem("annualDividends")) || {};
      // Update or add the key-value pair for the current ticker
      storedAnnualDividends[ticker] = { annualDividend: annualDiv };
      // Sort the object by keys (ticker symbols)
      const sortedAnnualDividends = Object.keys(storedAnnualDividends)
        .sort() // Sort keys alphabetically
        .reduce((sortedObj, key) => {
          sortedObj[key] = storedAnnualDividends[key]; // Rebuild the object in sorted order
          return sortedObj;
        }, {});
      // Save the updated object back to localStorage
      localStorage.setItem("annualDividends", JSON.stringify(sortedAnnualDividends));
      totalDividendPayment();
    }
  } else {
    console.log(`CalcAnnualDivs(): Ticker ${ticker} does not exist in the portfolio.`);
  }
}

// Function to prepare 'divMap' local storage object for calendar
function createDividendMap() {
  // Retrieve the existing dividend history object from local storage
  const dividendHistory = JSON.parse(localStorage.getItem('dividendHistory')) || {};
  const divMap = {};
  // Iterate over each ticker in the dividend history
  for (const ticker in dividendHistory) {
    const stockData = dividendHistory[ticker];
    const amounts = stockData.Amount;
    const paymentDates = stockData.PaymentDate;
    // Iterate over the amounts and payment dates using their shared index
    for (const index in amounts) {
      const amount = amounts[index];
      const paymentDate = paymentDates[index];
      if (paymentDate !== "None") {
        // Check if the payment date exists in divMap
        if (!divMap[paymentDate]) {
          divMap[paymentDate] = {}; // Create a new object for the payment date
        }
        // Add the ticker and its corresponding amount to the payment date
        divMap[paymentDate][ticker] = amount;
      }
    }
  }
  // Sort the payment dates in descending order (most recent first)
  const sortedDates = Object.keys(divMap).sort((a, b) => new Date(b) - new Date(a));
  // Create a new sorted divMap
  const sortedDivMap = {};
  sortedDates.forEach((date) => {
    sortedDivMap[date] = divMap[date];
  });
  // Save the sorted divMap back to local storage
  localStorage.setItem('divMap', JSON.stringify(sortedDivMap));
  console.log('CreateDividendMap(): divMap created and stored in local storage:', sortedDivMap);
  return null;
}

const totalDividendPayment = () => {
  let totalDividends = 0;
  const annualDividends = getDataFromLocalStorage('annualDividends');
  Object.values(annualDividends).forEach(value => {
    let tickerAnnualDividend = parseFloat(value.annualDividend);
    totalDividends += tickerAnnualDividend;
  });
  console.log(`Total Dividends: $${totalDividends.toFixed(2)}`);
  localStorage.setItem('totalAnnualDividends', totalDividends.toFixed(2));
  totalPaymentElement.textContent = totalDividends.toFixed(2);
};
totalDividendPayment();
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SAVE, LOAD, AND CLEAR ALL DATA BUTTONS

document.addEventListener('click', (event) => {
  const elementId = event.target.id;
  if (elementId === 'save-all-data-btn') {
    // Save all local storage data as a single JSON file
    const allData = {};
    const excludedKeys = ["ally-supports-cache"];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (excludedKeys.includes(key)) continue;

      const value = localStorage.getItem(key);
      try {
        allData[key] = JSON.parse(value);
      } catch (error) {
        allData[key] = value;
      }
    }

    const allDataJSON = JSON.stringify(allData, null, 2);
    const blob = new Blob([allDataJSON], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'all-data.json';
    link.click();

    console.log('All local storage data saved as all-data.json');
    alert('All Data Has Been Saved.');

  } else if (elementId === 'load-all-data-btn') {
    // Load all data from a JSON file and restore to localStorage
    const fileInput = document.getElementById('file-input');
    fileInput.click();
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const loadedData = JSON.parse(e.target.result);
            // Loop through the keys of the object directly
            Object.keys(loadedData).forEach(key => {
              
              const value = loadedData[key];
              console.log(`Storing ${key}:`, value); // Debug log
              
              localStorage.setItem(key, JSON.stringify(loadedData[key]));
            });
            console.log('All local storage data successfully loaded from all-data.json.');
            if (loadedData.portfolio) {
              portfolio = loadedData.portfolio;
              renderPortfolio();
            }
            alert('All local storage data has been restored.');
          } catch (error) {
            console.error('Failed to load data from file:', error);
            alert('Invalid JSON file.');
          }
        };
        reader.readAsText(file);
      } else {
        alert('Please select a valid JSON file.');
      }
    });
  } else if (elementId === 'clear-all-data-btn') {
    // Clear all localStorage data
    const confirmation = confirm('Are you sure you want to clear all local storage data? This action cannot be undone.');
    if (confirmation) {
      localStorage.clear();
      console.log('All local storage data has been cleared.');
      alert('All local storage data has been cleared.');
      portfolio = [];
      renderPortfolio();
    }
  }
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// API KEY FUNCTIONS

// Function to update the apiKey when the "Set" button is clicked
document.getElementById('setApiKeyButton').addEventListener('click', () => {
  const apiKeyInput = document.getElementById('api-key-input'); // Get the input element
  apiKey = apiKeyInput.value.trim(); // Get the value from the input and set it to apiKey variable
  if (apiKey !== '') {
    localStorage.setItem('apiKey', apiKey); // Save the API key to localStorage
    apiKeyInput.value = ''; // Clear the input field
    alert('API Key successfully set!'); // Show success alert
    console.log('API Key set:', apiKey); // For debugging
  } else {
    alert('Please enter a valid API Key.'); // Show error alert if input is empty
  }
});

// Function to load API key from localStorage on page load
window.onload = () => {
  const storedApiKey = localStorage.getItem('apiKey'); // Retrieve the stored API key
  if (storedApiKey) {
    apiKey = storedApiKey; // Set the apiKey variable to the stored value
    console.warn('Loaded API Key from localStorage:', apiKey); // For debugging
  }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// FETCH API AND SHARED DATA, OVERVIEW, DATA, AND DIVIDEND HISTORY SAVE FUNCTIONS

// Function to fetch API data
const fetchAPIData = async (passedTicker, passedType) => {
  // Ensure the 'ticker' and 'type' is passed and used properly
  if (!passedTicker || !passedType) {
    console.error('FetchAPIData(): Ticker or Type is undefined. Please provide valid inputs.');
    return null;
  }
  const ticker = passedTicker.toUpperCase();
  const type = passedType.toUpperCase();
  const url = `https://www.alphavantage.co/query?function=${type}&symbol=${ticker}&apikey=${apiKey}`;
  try {
    const response = await fetch(url);
    console.warn(`FetchAPIData(): ${ticker} ${type} data has been fetched using API key: ${apiKey}`);
    // Check if the response is JSON or plain text
    const data = await response.json().catch(() => null);
    // Ensure data is valid
    if (!data || data.Information) {
      console.warn('API Rate Limit reached or Error:', data ? data.Information : 'Unknown Error');
      alert('API rate limit reached. Please try again later or upgrade to a premium plan.');
      return null;
    }
    if (type === "OVERVIEW") {
      // Process API overview response data
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
    saveOverviewData('overviewData', ticker, parsedData);
    return null;
    } else if (type === "DIVIDENDS") {
      if (Array.isArray(data.data) && data.data.length > 0) {
        const latestDividend = data['data'][0];
        const previousDividend = data['data'][1] || {};
        const dividendHistory = [];
        const exDividendDates = [];
        const paymentDate = [];
        // Loops through the first 8 indexes of 'data' array
        for (let i = 0; i < 8; i++) {
          // Get each dividend object
          const dividend = data['data'][i];
          // Extract the 'amount', 'ex_dividend_date', and 'payment_date' values
          const amount = parseFloat(dividend['amount']) || 0.0000;
          const exDate = dividend['ex_dividend_date'] || "Unknown";
          const payDate = dividend['payment_date'] || "Unknown";
          dividendHistory.push(amount);
          exDividendDates.push(exDate);       
          paymentDate.push(payDate);
        }
        console.log(`FetchAPIData(): The first 8 indexes of ${ticker} have been calculated`);
        // Now save this dividend history to localStorage
        saveDividendHistoryData(ticker, dividendHistory, exDividendDates, paymentDate);
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
        console.error(`FetchAPIData(): No dividend data found for ${ticker}.`);
        return null;
      }
    }
  } catch (error) {
    console.error('FetchAPIData(): Error fetching API data:', error);
    return null;
  }
};

// Function to save parsed data to localStorage
const saveOverviewData = (key, ticker, newData) => {
  if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
    console.error(`Invalid ticker provided: ${ticker}`);
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
      console.log(`SaveOverviewData(): Overview data for ${ticker} is already up to date.`);
      return; // Do nothing if there are no changes
    } else {
      console.log(`SaveOverviewData(): Overview data for ${ticker} has changed. Updating.`);
    }
  } else {
    console.log(`SaveOverviewData(): No existing overview data found for ${ticker}. Adding overview data.`);
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
  console.log(`SaveOverviewData(): Overview data for ${ticker} has been saved to localStorage.`);
};

// Function to save the dividend history and ex-dividend dates to localStorage
const saveDividendHistoryData = (ticker, dividendHistory, exDividendDates, paymentDate) => {
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
      console.log(`SaveDividendHistoryData(): Dividend history for ${ticker} is already up to date.`);
      return;
    } else {
      console.log(`SaveDividendHistoryData(): Dividend history for ${ticker} has changed. Updating.`);
    }
  } else {
    console.log(`SaveDividendHistoryData(): No dividend history found for ${ticker}. Adding history data.`);
  }
  // Create a new object for the ticker with both 'Amount' and 'ExDate' and 'PaymentDate' keys
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
  console.log(`SaveDividendHistoryData(): Dividend history for ${ticker} has been saved to localStorage.`);
};

// Save fetched 'data' information from refetch
const saveFetchedData = (ticker, dataResponse) => {
  // Get existing data from localStorage
  let existingData = JSON.parse(localStorage.getItem('data')) || {};
  // Fallback to existing data for the ticker if available
  const existingTickerData = existingData[ticker] || {
    latest: {
      exDividendDate: "N/A",
      declarationDate: "N/A",
      recordDate: "N/A",
      paymentDate: stock.stockPaymentDate || "N/A",
      dividend: stock.stockDividend || 0.0000,
    },
    previous: {
      exDividendDate: "N/A",
      declarationDate: "N/A",
      recordDate: "N/A",
      paymentDate: "N/A",
      dividend: 0.0000,
    },
  };
  // Initialize the "latest" and "previous" objects using existing data
  const latest = { ...existingTickerData.latest };
  const previous = { ...existingTickerData.previous };
  // Check if fetched data is valid and update the "latest" data
  if (dataResponse && dataResponse.latest) {
    const { latest: fetchedLatest, previous: fetchedPrevious } = dataResponse;
    if (fetchedLatest) {
      latest.exDividendDate = fetchedLatest.exDividendDate || latest.exDividendDate;
      latest.declarationDate = fetchedLatest.declarationDate || latest.declarationDate;
      latest.recordDate = fetchedLatest.recordDate || latest.recordDate;
      latest.paymentDate = fetchedLatest.paymentDate || latest.paymentDate;
      latest.dividend = fetchedLatest.dividend || latest.dividend;
    }
    if (fetchedPrevious) {
      previous.exDividendDate = fetchedPrevious.exDividendDate || previous.exDividendDate;
      previous.declarationDate = fetchedPrevious.declarationDate || previous.declarationDate;
      previous.recordDate = fetchedPrevious.recordDate || previous.recordDate;
      previous.paymentDate = fetchedPrevious.paymentDate || previous.paymentDate;
      previous.dividend = fetchedPrevious.dividend || previous.dividend;
    }
  } else {
    console.log(`SaveFetchedData(): No valid data fetched for ${ticker}. Keeping existing data untouched.`);
  }
  // Create the ticker object with the updated or existing data
  const formattedData = { latest, previous };
  // Update the data with the new or updated stock
  existingData[ticker] = formattedData;
  // Sort the keys alphabetically and rebuild the existingData object
  const sortedData = Object.keys(existingData)
    .sort()
    .reduce((obj, key) => {
      obj[key] = existingData[key];
      return obj;
    }, {});
  // Save the updated 'data' object to localStorage
  localStorage.setItem('data', JSON.stringify(sortedData));
  console.log(`SaveFetchedData(): Latest and previous dividend data for ${ticker} saved to localStorage`);
  return latest;
}

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
    console.log('Manual entry mode is enabled. Skipping API fetch.');
    dividendInput.disabled = false;
    dividendInput.placeholder = 'Enter Dividend:';
    paymentDateInput.disabled = false;
    paymentDateInput.placeholder = 'Enter Payment Date:';
    toggleButton.textContent = 'Switch to API Fetch';
  } else {
    console.log('API fetch mode is enabled.');
    dividendInput.disabled = true;
    dividendInput.placeholder = 'API Fetch';
    paymentDateInput.disabled = true;
    paymentDateInput.placeholder = ' ';
    toggleButton.textContent = 'Switch to Manual Entry';
  }
});

// Form submission to add stock to portfolio
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
  // Saving dividend history for manually entered stocks
  const formattedDividnedTwoDecimal = parseFloat(dividendInput.value).toFixed(2);
  const dividendTwoDecimal = parseFloat(formattedDividnedTwoDecimal)

  if (isManualEntry || dataFetchFailed) {
    saveDividendHistoryData(stockName, [dividendTwoDecimal], 0, [stockPaymentDate]);
  }
  dataFetchFailed = false;
  
  // Add the stock to the portfolio
  portfolio.push({
    stockName,
    stockAmount: parseFloat(stockAmount), // Ensure it's stored as a number
    stockDividend: parseFloat(stockDividend),
    stockPaymentDate,
  });
  // Call function to get company overview
  fetchAPIData(stockName, "OVERVIEW");
  console.warn(`FormSubmission: ${stockName} added. Company overview data was fetched.`)
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
  console.log(`FormSubmission: Latest and previous dividend data for ${stockName} saved to localStorage`);

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
  // Calculate dividendMap after stock is added
  createDividendMap();
  setTimeout(() => {
  calcAnnualDivs(stockName);
  }, 1000)
});

// Event listener to fetch dividend when stock ticker is entered
document.getElementById('stock-name').addEventListener('blur', async (e) => {
  const ticker = e.target.value.toUpperCase();
  const dividendInput = document.getElementById('stock-dividend');
  const paymentDateInput = document.getElementById('stock-payment-date');
  fetchedDividendData = null; // Reset fetched data
  // Check if manual entry mode is enabled
  if (isManualEntry) {
    return; // Exit the function to avoid API calls
  }
  if (ticker) {
    dividendInput.disabled = true;
    dividendInput.placeholder = 'Fetching...';
    const dividendData = await fetchAPIData(ticker, "DIVIDENDS");
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
      dataFetchFailed = true;
      console.log('Manual entry mode is enabled.');
    }
  }
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// MY PORTFOLIO FUNCTIONS

// Function to display data on stock
const displayStockData = (stockName) => {
  // Fetch data from localStorage
  const overviewData = JSON.parse(localStorage.getItem('overviewData')) || {};
  const stockData = overviewData[stockName];
  if (!stockData) {
    alert(`Overview data not stored for ${stockName} yet. Try refetching to pull new data.`);
    return;
  }
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'popup-overlay';
  document.body.appendChild(overlay);
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
      <p><strong>Annual Dividend Per Share:</strong> $${stockData.dividendPerShare !== undefined && !isNaN(stockData.dividendPerShare) ? parseFloat(stockData.dividendPerShare).toFixed(2) : 'N/A'}</p>
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
  const overlay = document.getElementById('popup-overlay');
  // Enable page scrolling
  document.body.classList.remove('no-scroll');
  if (popup) popup.remove();
  if (overlay) {
    overlay.remove(); // Remove the overlay
  }
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
      <td contenteditable="true" onblur="updateStock(${index}, 'amount', this.textContent)">${parseFloat(stock.stockAmount).toFixed(4)}</td>
      <td>${parseFloat(stock.stockDividend).toFixed(4)}</td>
      <td id="full-dividend-${index}">$${fullDividend}</td>
      <td id="dividend-date">${formattedDate}</td>
      <td><button id="refetch-btn-${index}" class="portfolio-refetch-btn" data-index="${index}"  onclick="refetchDividend(${index})"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg></button></td> <!-- Refetch button -->
      <td><button onclick="removeStock(${index})" class="portfolio-rm-btn" ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg></button></td>
    `;
    portfolioTable.appendChild(row);
    // Add a click event listener to the stock name cell
    row.querySelector('.stock-name-cell').addEventListener('click', () => displayStockData(stock.stockName));
  });
  // Save portfolio to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  // Highlight row with payment date two months ago
  highlightOldStock();
  console.log('RenderPortfolio(): Table Rendered'); // Console Log Action
};

// Function to highlight the stock row with payment date 2 and 3 months ago
function highlightOldStock() {
  // Get the current date
  const today = new Date();
  // Create an array to store the months for 1, 2, and 3 months ago
  const monthsAgo = [];
  // Calculate the months for 1, 2, and 3 months ago
  for (let i = 1; i <= 3; i++) {
    const date = new Date(today);
    date.setMonth(today.getMonth() - i);
    monthsAgo.push(date.getMonth()); // Extract and store the month (0-based)
  }
  // Loop through the portfolio and check if the payment date matches any of the monthsAgo
  portfolio.forEach((stock, index) => {
    // Parse the payment date (Assuming the format is YYYY-MM-DD)
    const [year, month, day] = stock.stockPaymentDate.split('-');
    const stockMonth = parseInt(month) - 1; // Month is 1-based in the stock data, so subtract 1
    // Check if the stockMonth matches any of the months in monthsAgo
    if (monthsAgo.includes(stockMonth)) {
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
  const stock = portfolio[index];
  // Ensure value is valid number before attempting to parse and apply
  if (field === 'amount') {
    value = parseFloat(value);
    if (isNaN(value)) {
      alert('Invalid input for ' + field);
      return; // Exit early if value is not a valid number
    }
    stock.stockAmount = parseFloat(value.toFixed(4));
  }
  console.log(`UpdateStock(): ${stock.stockName} value manually updated to ${stock.stockAmount}.`);
  // Ensure the portfolio is saved/updated
  localStorage.setItem("portfolio", JSON.stringify(portfolio));
  calcAnnualDivs(stock.stockName);
  renderPortfolio();
};

// Remove stock from portfolio, dividendHistory, and data objects
window.removeStock = (index) => {
  const stock = portfolio.splice(index, 1)[0];
  const keys = ['data', 'dividendHistory', 'overviewData', 'annualDividends']
  for (const key of keys) {
    // Remove the corresponding entry from the localStorage object
    let existingData = JSON.parse(localStorage.getItem(key)) || {};
    // Delete the stock data by ticker symbol
    delete existingData[stock.stockName];
    // Save the updated localStorage object
    localStorage.setItem(key, JSON.stringify(existingData));
  }
  console.log(`${stock.stockName} has been removed.`)
  // Re-render the portfolio table
  renderPortfolio();
  createDividendMap();
};

// Refetch dividend
window.refetchDividend = async (index) => {
  let stock = portfolio[index];
  const button = document.getElementById(`refetch-btn-${index}`);
  const ticker = stock.stockName;
  // Update button text to indicate fetching
  button.textContent = 'Refetching...';
  let hasChanges = false; // Track if any changes occur
  try {
    // Fetch new dividend data
    const dividendData = await fetchAPIData(ticker, "DIVIDENDS");
    // Save the fetched data
    let latest = saveFetchedData(ticker, dividendData);
    // Logic to see if dividend or payment date has changed
    if (latest) {
      // Copy the original portfolio object for comparison
      const oldStock = { ...portfolio[index] }; 
      // Update portfolio with new values from fetch
      portfolio[index] = {
        stockName: ticker,
        stockAmount: stock.stockAmount,
        stockDividend: latest.dividend,
        stockPaymentDate: latest.paymentDate,
      };
      if (
        oldStock.stockDividend !== portfolio[index].stockDividend ||
        oldStock.stockPaymentDate !== portfolio[index].stockPaymentDate
      ) {
        hasChanges = true;
      }
    }

    // Re-render the portfolio and sort divMap only if changes occurred
    if (hasChanges) {
      console.error("RefetchDividend(): There has been a change. Running createDividendMap and renderPortfolio")
      createDividendMap();
      renderPortfolio();
    }
  } catch (error) {
    console.error(`RefetchDividend(): Error refetching dividend for ${ticker}:`, error);
  } finally {
    // Reset button text after operation
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>';
  }
  if (shouldFetch(ticker)) {
    // Call function to get company overview
    fetchAPIData(ticker, "OVERVIEW");
    console.warn(`RefetchDividend(): Fetch initiated for overview data for ${ticker}.`);
  } else {
    console.log(`RefetchDividend(): Overview data wasn't fetched for ${ticker} because the payment date hasn't changed.`);
  }
  // Resave Stock to localStorage
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  calcAnnualDivs(ticker);
  // Confirm data was refetched. Timeout for console logs
  setTimeout(() => {
  console.warn(`Refetch action for ticker ${ticker} is completed.`);
}, 2000);
};

// Load portfolio from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  const savedPortfolio = localStorage.getItem('portfolio');
  if (savedPortfolio) {
    portfolio = JSON.parse(savedPortfolio);
    renderPortfolio();
  }
});

// Function to check if should run subsequent fetch
const shouldFetch = (ticker) => {
  const overview = JSON.parse(localStorage.getItem('overviewData')) || {};
  const dividend = JSON.parse(localStorage.getItem('data')) || {};
  // Check if ticker data exists in both sources
  if (!overview[ticker] || !dividend[ticker]) {
    console.error(`Data for ${ticker} is missing in 'overviewData' and/or 'data'`);
    return true; // Fetch is required if data is incomplete
  }
  const overviewPayDate = overview[ticker].dividendDate;
  const divPayDate = dividend[ticker].latest.paymentDate;
  // Check if the latest payment date exists
  if (!divPayDate) {
    console.error(`Latest payment date in 'data' is missing for ticker ${ticker}.`);
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