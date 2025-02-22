import fetch from 'node-fetch';

/**
 * Bypass Cloudflare Turnstile using 2Captcha.
 *
 * @param {string} apiKey - Your 2Captcha API key.
 * @param {string} websiteURL - The full URL of the target page.
 * @param {string} websiteKey - The Turnstile sitekey (from the target page).
 * @param {string} taskType - Either "TurnstileTaskProxyless" for proxyless or "TurnstileTask" for proxy tasks.
 * @param {object} options - Optional parameters:
 *    - action, data, pagedata for challenge pages.
 *    - For proxy tasks: proxyType, proxyAddress, proxyPort, proxyLogin, proxyPassword.
 *    - pollInterval (ms) and maxAttempts for polling.
 * @returns {Promise<object>} - Returns a solution object containing the token and (if provided) userAgent.
 */
async function bypassTurnstile(apiKey, url, sitekey, taskType, options = {}) {
  // Build the task object.
  const task = {
    type: taskType,
    websiteURL: url,
    websiteKey: sitekey
  };

  // For Cloudflare Challenge pages, include additional parameters.
  if (options.action) task.action = options.action;
  if (options.data) task.data = options.data;
  if (options.pagedata) task.pagedata = options.pagedata;

  // For TurnstileTask (i.e. using your proxy), include proxy details.
  if (taskType === 'TurnstileTask') {
    if (!options.proxyType || !options.proxyAddress || !options.proxyPort) {
      throw new Error("Proxy details are required for TurnstileTask.");
    }
    task.proxyType = options.proxyType;
    task.proxyAddress = options.proxyAddress;
    task.proxyPort = options.proxyPort;
    if (options.proxyLogin) task.proxyLogin = options.proxyLogin;
    if (options.proxyPassword) task.proxyPassword = options.proxyPassword;
  }

  // Create the task request body.
  const requestBody = {
    clientKey: apiKey,
    task
  };

  // POST to create the Turnstile task.
  const createTaskResponse = await fetch('https://api.2captcha.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  const createTaskResult = await createTaskResponse.json();
  if (createTaskResult.errorId !== 0) {
    throw new Error(`Error creating Turnstile task: ${createTaskResult.errorCode || createTaskResult.errorDescription}`);
  }
  const taskId = createTaskResult.taskId;
  console.log(`Turnstile task created with ID: ${taskId}`);

  // Poll for the solution.
  const pollInterval = options.pollInterval || 5000; // default 5 seconds
  const maxAttempts = options.maxAttempts || 20;
  let attempts = 0;
  while (attempts < maxAttempts) {
    // Wait between polls.
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    const getTaskResultResponse = await fetch('https://api.2captcha.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        taskId: taskId
      })
    });
    const result = await getTaskResultResponse.json();
    if (result.errorId !== 0) {
      throw new Error(`Error getting Turnstile task result: ${result.errorCode || result.errorDescription}`);
    }
    if (result.status === 'ready') {
      // Return the solution (token and possibly userAgent).
      console.log('Turnstile bypass successful.');
      return result.solution;
    }
    attempts++;
  }
  throw new Error('Turnstile task result not ready within expected time.');
}

export { bypassTurnstile };