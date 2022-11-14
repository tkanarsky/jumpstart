const fetchData = async (endpoint, { body, ...customConfig } = {}) => {
  const headers = { "Content-Type": "application/json" };
  const config = {
    method: customConfig.method || body ? "POST" : "GET",
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  return fetch(endpoint, config);
};
