$(function () {
  const STORAGE_KEY = "inklist_user";
  let currentUser = null;
  let currentStatus = "active";
  let tasksRequest = null;

  function setButtonBusy($button, busy, busyText) {
    if (!$button.data("label")) {
      $button.data("label", $button.text());
    }
    $button.prop("disabled", busy).text(busy ? busyText : $button.data("label"));
  }

  function showToast(text) {
    const $toast = $("#toast").text(text).removeClass("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      $toast.addClass("hidden");
    }, 2400);
  }

  function setAuthMessage(text, ok) {
    $("#auth-message")
      .text(text || "")
      .toggleClass("success", Boolean(ok));
  }

  function itemsToArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.keys(data)
      .sort(function (a, b) {
        return Number(a) - Number(b);
      })
      .map(function (key) {
        return data[key];
      });
  }

  function saveSession(user) {
    currentUser = user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function clearSession() {
    currentUser = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  function showApp() {
    const name = currentUser.fname || "there";
    $("#greeting").text("Hello, " + name);
    $("#auth-view").addClass("hidden");
    $("#app-view").removeClass("hidden");
    loadTasks();
  }

  function showAuth() {
    $("#app-view").addClass("hidden");
    $("#auth-view").removeClass("hidden");
    $("#signin-form [name=email]").trigger("focus");
  }

  function renderTasks(items) {
    const $list = $("#task-list").empty();
    $("#task-count").text(items.length + (items.length === 1 ? " task" : " tasks"));

    if (!items.length) {
      $list.append(
        $("<div class='empty'>").text(
          currentStatus === "active"
            ? "Nothing active yet. Add a task to begin."
            : "No finished tasks yet."
        )
      );
      return;
    }

    items.forEach(function (item) {
      const $card = $("<article class='task'>");
      $card.append($("<h4>").text(item.item_name));
      if (item.item_description) {
        $card.append($("<p>").text(item.item_description));
      }
      const taskDate = item.timemodified || item.dateTime_created;
      $card.append(
        $("<div class='task-meta'>").text(taskDate ? "Updated " + taskDate : "Recently added")
      );

      const $actions = $("<div class='task-actions'>");
      const nextStatus = item.status === "active" ? "inactive" : "active";
      const statusLabel = item.status === "active" ? "Mark done" : "Restore";

      $("<button type='button' class='btn ghost'>")
        .text("Edit")
        .on("click", function () {
          openEdit(item);
        })
        .appendTo($actions);

      $("<button type='button' class='btn ghost'>")
        .text(statusLabel)
        .on("click", function () {
          TodoAPI.changeStatus(item.item_id, nextStatus)
            .done(function (res) {
              showToast(res.message || "Status updated");
              loadTasks();
            })
            .fail(handleAjaxError);
        })
        .appendTo($actions);

      $("<button type='button' class='btn danger'>")
        .text("Delete")
        .on("click", function () {
          if (!window.confirm("Delete this task?")) return;
          TodoAPI.deleteItem(item.item_id)
            .done(function (res) {
              showToast(res.message || "Item deleted");
              loadTasks();
            })
            .fail(handleAjaxError);
        })
        .appendTo($actions);

      $card.append($actions);
      $list.append($card);
    });
  }

  function loadTasks() {
    if (!currentUser) return;
    if (tasksRequest) {
      tasksRequest.abort();
    }

    $("#task-count").text("Loading…");
    $("#task-list").html("<div class='empty loading'>Loading your tasks…</div>");

    tasksRequest = TodoAPI.getItems(currentUser.id, currentStatus)
      .done(function (res) {
        if (res.status !== 200) {
          showToast(res.message || "Could not load tasks");
          renderTasks([]);
          return;
        }
        renderTasks(itemsToArray(res.data));
      })
      .fail(function (xhr, textStatus) {
        if (textStatus === "abort") return;
        showToast(TodoAPI.messageFromXhr(xhr));
        renderTasks([]);
      })
      .always(function () {
        tasksRequest = null;
      });
  }

  function handleAjaxError(xhr) {
    const message = TodoAPI.messageFromXhr(xhr);
    showToast(message);
  }

  function openEdit(item) {
    const $form = $("#edit-form");
    $form.find("[name=item_id]").val(item.item_id);
    $form.find("[name=item_name]").val(item.item_name);
    $form.find("[name=item_description]").val(item.item_description || "");
    document.getElementById("edit-dialog").showModal();
  }

  $(".tab-btn").on("click", function () {
    const tab = $(this).data("tab");
    $(".tab-btn").removeClass("is-active");
    $(this).addClass("is-active");
    $(".tab-btn").attr("aria-selected", "false");
    $(this).attr("aria-selected", "true");
    $("#signin-form").toggleClass("hidden", tab !== "signin");
    $("#signup-form").toggleClass("hidden", tab !== "signup");
    setAuthMessage("");
  });

  $(".pill").on("click", function () {
    currentStatus = $(this).data("status");
    $(".pill").removeClass("is-active").attr("aria-selected", "false");
    $(this).addClass("is-active").attr("aria-selected", "true");
    loadTasks();
  });

  $("#signin-form").on("submit", function (e) {
    e.preventDefault();
    const $button = $(this).find("[type=submit]");
    const email = this.email.value.trim();
    const password = this.password.value;
    setButtonBusy($button, true, "Signing in…");
    setAuthMessage("");
    TodoAPI.signIn(email, password)
      .done(function (res) {
        if (res.status !== 200) {
          setAuthMessage(res.message || "Sign in failed", false);
          return;
        }
        saveSession(res.data);
        setAuthMessage("");
        showApp();
      })
      .fail(function (xhr) {
        setAuthMessage(TodoAPI.messageFromXhr(xhr), false);
      })
      .always(function () {
        setButtonBusy($button, false);
      });
  });

  $("#signup-form").on("submit", function (e) {
    e.preventDefault();
    const $button = $(this).find("[type=submit]");
    const payload = {
      first_name: this.first_name.value.trim(),
      last_name: this.last_name.value.trim(),
      email: this.email.value.trim(),
      password: this.password.value,
      confirm_password: this.confirm_password.value,
    };
    if (payload.password !== payload.confirm_password) {
      setAuthMessage("Passwords do not match.");
      return;
    }
    setButtonBusy($button, true, "Creating account…");
    setAuthMessage("");
    TodoAPI.signUp(payload)
      .done(function (res) {
        if (res.status !== 200) {
          setAuthMessage(res.message || "Sign up failed", false);
          return;
        }
        setAuthMessage(res.message + " You can sign in now.", true);
        $(".tab-btn[data-tab=signin]").trigger("click");
        $("#signin-form [name=email]").val(payload.email);
      })
      .fail(function (xhr) {
        setAuthMessage(TodoAPI.messageFromXhr(xhr), false);
      })
      .always(function () {
        setButtonBusy($button, false);
      });
  });

  $("#add-form").on("submit", function (e) {
    e.preventDefault();
    const $button = $(this).find("[type=submit]");
    const payload = {
      item_name: this.item_name.value.trim(),
      item_description: this.item_description.value.trim(),
      user_id: currentUser.id,
    };
    if (!payload.item_name) return;
    setButtonBusy($button, true, "Adding…");
    TodoAPI.addItem(payload)
      .done(function (res) {
        if (res.status !== 200) {
          showToast(res.message || "Could not add task");
          return;
        }
        e.target.reset();
        currentStatus = "active";
        $(".pill").removeClass("is-active").attr("aria-selected", "false");
        $(".pill[data-status=active]")
          .addClass("is-active")
          .attr("aria-selected", "true");
        showToast(res.message || "Item added");
        loadTasks();
      })
      .fail(handleAjaxError)
      .always(function () {
        setButtonBusy($button, false);
      });
  });

  $("#edit-form").on("submit", function (e) {
    e.preventDefault();
    const $button = $(this).find("[type=submit]");
    const payload = {
      item_id: Number(this.item_id.value),
      item_name: this.item_name.value.trim(),
      item_description: this.item_description.value.trim(),
    };
    if (!payload.item_name) return;
    setButtonBusy($button, true, "Saving…");
    TodoAPI.updateItem(payload)
      .done(function (res) {
        if (res.status !== 200) {
          showToast(res.message || "Could not update task");
          return;
        }
        document.getElementById("edit-dialog").close();
        showToast(res.message || "Item updated");
        loadTasks();
      })
      .fail(handleAjaxError)
      .always(function () {
        setButtonBusy($button, false);
      });
  });

  $("#edit-cancel").on("click", function () {
    document.getElementById("edit-dialog").close();
  });

  $("#signout-btn").on("click", function () {
    if (tasksRequest) tasksRequest.abort();
    clearSession();
    $("#task-list").empty();
    showAuth();
  });

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentUser = JSON.parse(stored);
      showApp();
    }
  } catch (err) {
    clearSession();
  }
});
