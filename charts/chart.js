const ctx = document.getElementById('dividend-chart').getContext('2d');
const ctx2 = document.getElementById("history-chart").getContext("2d");
const placeholderLabels = Array.from({ length: 10 }, (_, i) => ``);
const placeholderData = Array(10).fill(0); // Flat line at 0

let displayedMonth = new Date().getMonth();
let displayedYear = new Date().getFullYear();



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

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// SAVE AND LOAD BUTTONS

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
            for (const key in loadedData) {
              if (loadedData.hasOwnProperty(key)) {
                localStorage.setItem(key, JSON.stringify(loadedData[key]));
              }
            }

            console.log('All local storage data successfully loaded from all-data.json.');

            if (loadedData.portfolio) {
              portfolio = loadedData.portfolio;
              totalDividends = portfolio.reduce((total, stock) => total + stock.stockAmount * parseFloat(stock.stockDividend), 0);
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

  }
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// CALENDAR FUNCTIONS

// Function to get data from local storage
function getDataFromLocalStorage(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : {};
}

// Call the generateCalendar function when the page loads
document.addEventListener('DOMContentLoaded', () => {generateCalendar();});

// Function to get date information
function getDateInfo(month = displayedMonth, year = displayedYear) {
  const today = new Date();
  const currentMonth = month;
  const currentYear = year;

  // Get the first and last day of the current month
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0); // Last day of the month
  const totalDays = lastDay.getDate(); // Number of days in the current month
  const firstDayWeekday = firstDay.getDay(); // Day of the week for the first day of the month

  return { currentMonth, currentYear, firstDay, lastDay, totalDays, firstDayWeekday, today };
}

// Function to calculate the displayed months dividends per day
function calculateDividendsMap(currentMonth, currentYear) {
  const dividendsMap = {};
  const portfolio = getDataFromLocalStorage("portfolio"); // Retrieve the portfolio object
  const history = getDataFromLocalStorage("dividendHistory"); // Retrieve the dividendHistory object

  // Iterate over the keys in the portfolio (the ticker symbols)
  for (const ticker in portfolio) {
    const stock = portfolio[ticker];
    const stockAmount = parseFloat(stock.stockAmount) || 0;
  
    // Skip if stockAmount is invalid
    if (stockAmount <= 0) {
      console.log(`Skipping ticker ${ticker} due to invalid stock amount.`);
      continue;
    }

    // Ticker in the format that dividendHistory needs
    const symbol = stock.stockName;
    // Check if we have history for the current ticker
    const tickerHistory = history[symbol];

    // If no valid history is found then continue
    if (!tickerHistory || !tickerHistory.PaymentDate || !tickerHistory.Amount) {
      console.warn(`No valid history found for ticker ${symbol}.`);
      continue;
    }
  
    // Convert Amount and PaymentDate to arrays
    const paymentDates = Object.values(tickerHistory.PaymentDate);
    const amounts = Object.values(tickerHistory.Amount);
  
    // Iterate through the first 8 indexes of the history
    for (let i = 0; i < 8; i++) {
      const paymentDateStr = paymentDates[i];
      const paymentAmount = parseFloat(amounts[i]) || 0;
  
      // Skip if the payment date or amount is invalid
      if (!paymentDateStr || paymentAmount <= 0) {
        continue;
      }
  
      const paymentDate = new Date(paymentDateStr);
  
      // Only include payments for the specified month and year
      if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
        const paymentDay = paymentDate.getDate(); // Day of the month (1-31)
  
        // Total dividend is based on historical paymentAmount and current stockAmount
        const totalDividend = (paymentAmount * stockAmount).toFixed(2);
  
        // Add to dividendsMap, combining totals for the same day
        dividendsMap[paymentDay] = dividendsMap[paymentDay]
          ? (parseFloat(dividendsMap[paymentDay]) + parseFloat(totalDividend)).toFixed(2)
          : totalDividend;
      }
    }
  }
  return dividendsMap;
}

// Function to generate calendar
function generateCalendar() {
  const { currentMonth, currentYear, totalDays, firstDayWeekday, today } = getDateInfo(displayedMonth, displayedYear);
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
  

  // Calculate the total dividends for the current month
  let totalDividendsForMonth = 0;
  Object.values(dividendsMap).forEach(dividend => {
    totalDividendsForMonth += parseFloat(dividend);
  });

  // Update the total dividends display
  totalDividendsElement.textContent = `Estimated Total Dividends: $${totalDividendsForMonth.toFixed(2)}`;
  alert(totalDividendsForMonth + ' IS TOTAL DIVS FOR MONTH ');

  // Create the days of the month
  for (let day = 1; day <= totalDays; day++) {
    const dayElement = document.createElement('div');
    dayElement.textContent = day;
    dayElement.classList.add('day');
    
    // Highlight today's date only if it's the current month and year
    if (
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear() &&
      day === today.getDate()
    ) {
      dayElement.classList.add('today');
    }

    // Display the dividend total if it exists for this day
    if (dividendsMap[day]) {
      const dividendTotal = document.createElement('div');
      alert(dividendTotal + ' IS CREATED ');
      dividendTotal.classList.add('dividend-total');
      alert(dividendsMap[day]);
      dividendTotal.textContent = `$${dividendsMap[day]}`;
      dayElement.appendChild(dividendTotal);
      alert(dayElement + ' IS APPENDED ');
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
    emptyCell.classList.add('empty-day');
  }
  console.log('Calendar Rendered'); // Console Log Action
}

// Event listeners for previous month and next month buttons
document.getElementById('prev-month').addEventListener('click', () => {
  displayedMonth -= 1;
  if (displayedMonth < 0) {
    displayedMonth = 11; // Wrap to December of the previous year
    displayedYear -= 1;
  }
  generateCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  displayedMonth += 1;
  if (displayedMonth > 11) {
    displayedMonth = 0; // Wrap to January of the next year
    displayedYear += 1;
  }
  generateCalendar();
});

document.getElementById('current-month').addEventListener('click', () => {
  // Reset to current month and year
  displayedMonth = new Date().getMonth();
  displayedYear = new Date().getFullYear();

  // Regenerate the calendar for the current month and year
  generateCalendar();
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
    console.log(`${ticker} not found in portfolio.`);

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
    alert(`${ticker} not found in your portfolio.`);
  }

  // Clear the input field and show the placeholder
  tickerInput.value = '';
};

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
  const portfolioData = JSON.parse(localStorage.getItem("portfolio")) || {};
  let portfolio = [];

  portfolioData.forEach((stock) => {
    ticker = stock.stockName;
    portfolio.push(ticker);
  });

  // Check if tickerInput is in the portfolio
  const isTickerInPortfolio = portfolioData.some(stock => stock.stockName === tickerInput);
  
  if (!isTickerInPortfolio) {
    alert(`${tickerInput} is not in your portfolio.`);
  } else {
    if (!storedHistory[tickerInput]) {
      alert(`${tickerInput} is in your portfolio, but it doesnt have history data yet. Try refetching to pull new data.`);
      return;
    } else {
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
  
    };
  };
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// DIVIDEND GROWTH CHART FUNCTIONS

// Check if chart data exists in localStorage and initialize chart
const chartData = JSON.parse(localStorage.getItem('chartData')) || { labels: [], data: [] };

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
  
  // Get the totalDividends value, and convert it to a float
  const totalDividends = parseFloat(localStorage.getItem('sharedData')); 

  // If 'sharedData' is not a valid number, return early
  if (isNaN(totalDividends)) {
    console.warn('Invalid totalDividends value.');
    return;
  }

  const chartData = JSON.parse(localStorage.getItem('chartData')) || { labels: [], data: [] }; // Get chartData or initialize if not found
  
  const index = chartData.labels.indexOf(localDate);  // Check if the date already exists in the labels

  if (index !== -1) {
    // Update the Y-axis value for the current date
    chartData.data[index] = totalDividends;
  } else {
    // Add a new point for today's date
    chartData.labels.push(localDate);
    chartData.data.push(totalDividends);
  }

  // Save the updated chart data back to localStorage
  localStorage.setItem('chartData', JSON.stringify(chartData));

  // Update the chart with the new data
  dividendChart.data.labels = chartData.labels;
  dividendChart.data.datasets[0].data = chartData.data;

  dividendChart.update();  // Update the chart
  console.log('Chart Point Set');
};

// Button to set a new data point when clicked
document.getElementById('set-dividend-btn').addEventListener('click', () => {
  updateChart(); // Update the chart with the current total dividends
});

// // Function to handle dividend logic for payment dates in portfoliio
// function calculateDividendsMap(currentMonth, currentYear) {
//   const dividendsMap = {};
//   const portfolio = getPortfolio(); // Retrieve the portfolio from the new location

//   // Iterate over the keys in the portfolio (the ticker symbols)
//   for (const ticker in portfolio) {
//     const stock = portfolio[ticker];
//     const paymentDateStr = stock.stockPaymentDate; // yyy-mm-dd

//     // If there's no payment date, skip this stock
//     if (!paymentDateStr) continue;

//     const [year, month, day] = paymentDateStr.split('-'); // Extract year, month, and day

//     // Create a date object for the payment date
//     const paymentDate = new Date(year, month - 1, day);

//     // Only add dividends for the current month
//     if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
//       const paymentDay = paymentDate.getDate(); // Correct day of the month (1-31)

//       const totalDividend = ((stock.stockAmount * stock.stockDividend)).toFixed(2); // Use the dividend from the latest data

//       // Store the dividend total for the day
//       if (dividendsMap[paymentDay]) {
//         dividendsMap[paymentDay] = (parseFloat(dividendsMap[paymentDay]) + parseFloat(totalDividend)).toFixed(2);
//       } else {
//         dividendsMap[paymentDay] = totalDividend;
//       }
//     }
//   }

//   return dividendsMap;
// }