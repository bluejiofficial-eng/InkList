const API_ROOT = "https://todo-list.dcism.org";

function extractJson(raw) {
  const text = String(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function apiRequest(method, route, payload, useQuery) {
  const options = {
    url: API_ROOT + route,
    method: method,
    dataType: "json",
    dataFilter: extractJson,
    converters: {
      "text json": function (text) {
        return JSON.parse(extractJson(text));
      },
    },
  };

  if (useQuery && payload) {
    options.url += "?" + $.param(payload);
  } else if (payload && method !== "GET") {
    // text/plain keeps this a simple CORS request. application/json
    // triggers a preflight that this API does not authorize.
    options.contentType = "text/plain; charset=UTF-8";
    options.processData = false;
    options.data = JSON.stringify(payload);
  }

  return $.ajax(options);
}

const TodoAPI = {
  signUp: function (data) {
    return apiRequest("POST", "/signup_action.php", data);
  },
  signIn: function (email, password) {
    return apiRequest("GET", "/signin_action.php", { email: email, password: password }, true);
  },
  getItems: function (userId, status) {
    return apiRequest("GET", "/getItems_action.php", { user_id: userId, status: status }, true);
  },
  addItem: function (data) {
    return apiRequest("POST", "/addItem_action.php", data);
  },
  updateItem: function (data) {
    return apiRequest("POST", "/editItem_action.php", data);
  },
  changeStatus: function (itemId, status) {
    return apiRequest("POST", "/statusItem_action.php", {
      item_id: itemId,
      status: status,
    });
  },
  deleteItem: function (itemId) {
    return apiRequest("POST", "/deleteItem_action.php", { item_id: itemId }, true);
  },
  messageFromXhr: function (xhr) {
    if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
      return xhr.responseJSON.message;
    }
    try {
      const parsed = JSON.parse(extractJson((xhr && xhr.responseText) || ""));
      if (parsed && parsed.message) return parsed.message;
    } catch (err) {
      /* ignore */
    }
    if (xhr && xhr.status === 0) {
      return "The browser blocked the API request. Refresh the page and try again.";
    }
    return "Something went wrong. Try again.";
  },
};
