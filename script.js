const seedInventoryData = [
    { id: "1741D", name: "Camiseta", sku: "12569756", company: "Veritas", stock: 1108, lastMod: "2023-04-01 10:30" },
    { id: "1742D", name: "Camisa Longa", sku: "12569757", company: "System", stock: 500, lastMod: "2023-04-01 11:00" },
    { id: "1743D", name: "Calca Social", sku: "12569758", company: "Fides", stock: 240, lastMod: "2023-04-02 09:15" },
    { id: "1744D", name: "Bota PVC", sku: "12569759", company: "SP Serv", stock: 85, lastMod: "2023-04-02 14:45" },
];

function formatLastMod(dateValue) {
    if (!dateValue) {
        return "-";
    }
    return new Date(dateValue).toLocaleString("pt-BR");
}

const editSvgIcon = `
    <img
        src="public/edit-static.svg"
        data-static-src="public/edit-static.svg"
        data-anim-src="public/edit.gif"
        alt="Edit"
        class="edit-icon icon-animatable"
        width="24"
        height="24"
    />
`;

const deleteSvgIcon = `
    <img
        src="public/delete-static.svg"
        data-static-src="public/delete-static.svg"
        data-anim-src="public/delete.gif"
        alt="Delete"
        class="delete-icon icon-animatable"
        width="24"
        height="24"
    />
`;

class InventoryRepository {
    constructor(initialData = []) {
        this.items = [...initialData];
    }

    async list() {
        return [...this.items];
    }

    async getById(id) {
        return this.items.find((item) => item.id === id) || null;
    }

    async updateById(id, payload) {
        let updatedItem = null;
        this.items = this.items.map((item) => {
            if (item.id !== id) {
                return item;
            }
            updatedItem = { ...item, ...payload };
            return updatedItem;
        });
        return updatedItem;
    }

    async create(payload) {
        const newItem = {
            id: `LOCAL-${Date.now()}`,
            sku: `${Math.floor(10000000 + Math.random() * 89999999)}`,
            name: payload.name,
            company: payload.company,
            stock: payload.stock,
            lastMod: new Date().toLocaleString("pt-BR"),
        };
        this.items = [newItem, ...this.items];
        return newItem;
    }

    async removeById(id) {
        const before = this.items.length;
        this.items = this.items.filter((item) => item.id !== id);
        return this.items.length < before;
    }
}

class SupabaseInventoryRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.table = "inventory_items";
    }

    async list() {
        const { data, error } = await this.supabase
            .from(this.table)
            .select("id, name, sku, company, stock, last_mod")
            .order("id", { ascending: true });

        if (error) {
            throw new Error(`Falha ao listar inventario: ${error.message}`);
        }

        return data.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            company: item.company,
            stock: item.stock,
            lastMod: formatLastMod(item.last_mod),
        }));
    }

    async getById(id) {
        const { data, error } = await this.supabase
            .from(this.table)
            .select("id, name, sku, company, stock, last_mod")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw new Error(`Falha ao buscar item ${id}: ${error.message}`);
        }

        return {
            id: data.id,
            name: data.name,
            sku: data.sku,
            company: data.company,
            stock: data.stock,
            lastMod: formatLastMod(data.last_mod),
        };
    }

    async create(payload) {
        const { data, error } = await this.supabase
            .from(this.table)
            .insert({
                name: payload.name,
                company: payload.company,
                stock: payload.stock,
                last_mod: new Date().toISOString(),
            })
            .select("id, name, sku, company, stock, last_mod")
            .single();

        if (error) {
            throw new Error(`Falha ao criar item: ${error.message}`);
        }

        return {
            id: data.id,
            name: data.name,
            sku: data.sku,
            company: data.company,
            stock: data.stock,
            lastMod: formatLastMod(data.last_mod),
        };
    }

    async updateById(id, payload) {
        const { data, error } = await this.supabase
            .from(this.table)
            .update({
                ...payload,
                last_mod: new Date().toISOString(),
            })
            .eq("id", id)
            .select("id, name, sku, company, stock, last_mod")
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw new Error(`Falha ao atualizar item ${id}: ${error.message}`);
        }

        return {
            id: data.id,
            name: data.name,
            sku: data.sku,
            company: data.company,
            stock: data.stock,
            lastMod: formatLastMod(data.last_mod),
        };
    }

    async removeById(id) {
        const { error } = await this.supabase
            .from(this.table)
            .delete()
            .eq("id", id);

        if (error) {
            throw new Error(`Falha ao excluir item ${id}: ${error.message}`);
        }

        return true;
    }
}

class InventoryService {
    constructor(repository) {
        this.repository = repository;
    }

    async getInventory() {
        return this.repository.list();
    }

    async searchInventory(term) {
        const normalizedTerm = term.trim().toLowerCase();
        const items = await this.repository.list();
        if (!normalizedTerm) {
            return items;
        }
        return items.filter((item) => (
            item.name.toLowerCase().includes(normalizedTerm)
            || item.sku.toLowerCase().includes(normalizedTerm)
            || item.id.toLowerCase().includes(normalizedTerm)
            || item.company.toLowerCase().includes(normalizedTerm)
        ));
    }

    async updateInventoryItem(id, payload) {
        const safeName = payload.name.trim();
        const safeStock = Number(payload.stock);

        if (!safeName) {
            throw new Error("Nome do produto nao pode ficar vazio.");
        }

        if (!Number.isInteger(safeStock) || safeStock < 0) {
            throw new Error("Estoque precisa ser um numero inteiro maior ou igual a zero.");
        }

        const updatedItem = await this.repository.updateById(id, {
            name: safeName,
            stock: safeStock,
        });

        if (!updatedItem) {
            throw new Error("Item nao encontrado para atualizacao.");
        }

        return updatedItem;
    }

    async deleteInventoryItem(id) {
        return this.repository.removeById(id);
    }

    async createInventoryItem(payload) {
        const safeName = payload.name.trim();
        const safeCompany = payload.company.trim();
        const safeStock = Number(payload.stock);

        if (!safeName || !safeCompany) {
            throw new Error("Nome e empresa sao obrigatorios.");
        }

        if (!Number.isInteger(safeStock) || safeStock < 0) {
            throw new Error("Estoque precisa ser um numero inteiro maior ou igual a zero.");
        }

        return this.repository.create({
            name: safeName,
            company: safeCompany,
            stock: safeStock,
        });
    }
}

const state = {
    currentSearchTerm: "",
    editingItemId: null,
    selectedCompany: "",
    selectedId: "",
    viewMode: "list",
    allItems: [],
};

const elements = {
    inventoryBody: document.getElementById("inventoryBody"),
    inventoryGrid: document.getElementById("inventoryGrid"),
    tableContainer: document.getElementById("tableContainer"),
    searchInput: document.getElementById("searchInput"),
    companyFilter: document.getElementById("companyFilter"),
    idFilter: document.getElementById("idFilter"),
    modalEditOverlay: document.getElementById("modalEditOverlay"),
    modalAddOverlay: document.getElementById("modalAddOverlay"),
    pEditId: document.getElementById("pEditId"),
    pEditName: document.getElementById("pEditName"),
    pEditSku: document.getElementById("pEditSku"),
    pEditStock: document.getElementById("pEditStock"),
    pAddId: document.getElementById("pAddId"),
    pAddName: document.getElementById("pAddName"),
    pAddSku: document.getElementById("pAddSku"),
    pAddCompany: document.getElementById("pAddCompany"),
    pAddStock: document.getElementById("pAddStock"),
    saveEditButton: document.getElementById("saveEditButton"),
    cancelEditButton: document.getElementById("cancelEditButton"),
    saveAddButton: document.getElementById("saveAddButton"),
    cancelAddButton: document.getElementById("cancelAddButton"),
    addItemButton: document.getElementById("addItemButton"),
    listViewButton: document.getElementById("listViewButton"),
    gridViewButton: document.getElementById("gridViewButton"),
    toastContainer: document.getElementById("toastContainer"),
    kpiTotalItems: document.getElementById("kpiTotalItems"),
    kpiTotalStock: document.getElementById("kpiTotalStock"),
    kpiCompanies: document.getElementById("kpiCompanies"),
    kpiLowStock: document.getElementById("kpiLowStock"),
    companyChart: document.getElementById("companyChart"),
    lowStockBody: document.getElementById("lowStockBody"),
    menuItems: document.querySelectorAll(".menu-item[data-tab]"),
};

function buildRepository() {
    const cfg = window.SUPABASE_CONFIG;
    const hasCfg = cfg && cfg.url && cfg.anonKey && !cfg.url.includes("YOUR_PROJECT_ID");
    if (hasCfg && window.supabase?.createClient) {
        const supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
        return new SupabaseInventoryRepository(supabaseClient);
    }
    return new InventoryRepository(seedInventoryData);
}

const inventoryService = new InventoryService(buildRepository());

function showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === "success" ? "✓" : "!"}</div>
        <div>
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function animateActionIcon(target) {
    const icon = target.closest("button[data-action]")?.querySelector(".icon-animatable");
    if (!icon) {
        return;
    }

    const staticSrc = icon.dataset.staticSrc;
    const animSrc = icon.dataset.animSrc;
    if (!staticSrc || !animSrc) {
        return;
    }

    if (icon.dataset.animating === "1") {
        return;
    }

    icon.dataset.animating = "1";
    icon.src = `${animSrc}?t=${Date.now()}`;
    setTimeout(() => {
        icon.src = staticSrc;
        icon.dataset.animating = "0";
    }, 700);
}

function applyFilters(items) {
    const term = state.currentSearchTerm.trim().toLowerCase();
    return items.filter((item) => {
        const matchesTerm = !term
            || item.name.toLowerCase().includes(term)
            || item.sku.toLowerCase().includes(term)
            || item.id.toLowerCase().includes(term)
            || item.company.toLowerCase().includes(term);
        const matchesCompany = !state.selectedCompany || item.company === state.selectedCompany;
        const matchesId = !state.selectedId || item.id === state.selectedId;
        return matchesTerm && matchesCompany && matchesId;
    });
}

function updateFilterOptions(items) {
    const currentCompany = state.selectedCompany;
    const currentId = state.selectedId;
    const companies = [...new Set(items.map((item) => item.company))].sort();
    const ids = [...new Set(items.map((item) => item.id))].sort();

    elements.companyFilter.innerHTML = `<option value="">All Companies</option>${companies
        .map((company) => `<option value="${company}">${company}</option>`)
        .join("")}`;
    elements.idFilter.innerHTML = `<option value="">All IDs</option>${ids
        .map((id) => `<option value="${id}">${id}</option>`)
        .join("")}`;

    elements.companyFilter.value = companies.includes(currentCompany) ? currentCompany : "";
    elements.idFilter.value = ids.includes(currentId) ? currentId : "";
    state.selectedCompany = elements.companyFilter.value;
    state.selectedId = elements.idFilter.value;
}

function renderTable(data) {
    elements.inventoryBody.innerHTML = "";

    data.forEach((item, index) => {
        const row = document.createElement("tr");
        row.style.animationDelay = `${index * 25}ms`;
        row.classList.add("row-enter");
        row.innerHTML = `
            <td><input type="checkbox"></td>
            <td>${item.id}</td>
            <td><strong>${item.name}</strong></td>
            <td><code>${item.sku}</code></td>
            <td>${item.company}</td>
            <td>${item.stock}</td>
            <td style="color: #aaa; font-size: 12px; font-style: italic;">${item.lastMod}</td>
            <td class="action-group">
                <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">${editSvgIcon}</button>
                <button class="action-btn" type="button" data-action="delete" data-id="${item.id}" data-name="${item.name}">${deleteSvgIcon}</button>
            </td>
        `;
        elements.inventoryBody.appendChild(row);
    });
}

function renderGrid(data) {
    elements.inventoryGrid.innerHTML = "";
    data.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "inventory-card";
        card.style.animationDelay = `${index * 25}ms`;
        card.innerHTML = `
            <h4>${item.name}</h4>
            <p><strong>ID:</strong> ${item.id}</p>
            <p><strong>SKU:</strong> ${item.sku}</p>
            <p><strong>Company:</strong> ${item.company}</p>
            <p><strong>Stock:</strong> ${item.stock}</p>
            <p><strong>Last Modified:</strong> ${item.lastMod}</p>
            <div class="card-footer">
                <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">${editSvgIcon}</button>
                <button class="action-btn" type="button" data-action="delete" data-id="${item.id}" data-name="${item.name}">${deleteSvgIcon}</button>
            </div>
        `;
        elements.inventoryGrid.appendChild(card);
    });
}

function renderCurrentView(filteredItems) {
    if (state.viewMode === "grid") {
        elements.tableContainer.classList.add("hidden");
        elements.inventoryGrid.classList.remove("hidden");
        renderGrid(filteredItems);
        return;
    }
    elements.inventoryGrid.classList.add("hidden");
    elements.tableContainer.classList.remove("hidden");
    renderTable(filteredItems);
}

function renderDashboard(items) {
    const totalItems = items.length;
    const totalStock = items.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const companiesMap = items.reduce((acc, item) => {
        acc[item.company] = (acc[item.company] || 0) + Number(item.stock || 0);
        return acc;
    }, {});
    const companiesCount = Object.keys(companiesMap).length;
    const lowStockItems = items
        .filter((item) => Number(item.stock) <= 100)
        .sort((a, b) => Number(a.stock) - Number(b.stock));

    elements.kpiTotalItems.textContent = `${totalItems}`;
    elements.kpiTotalStock.textContent = `${totalStock.toLocaleString("pt-BR")}`;
    elements.kpiCompanies.textContent = `${companiesCount}`;
    elements.kpiLowStock.textContent = `${lowStockItems.length}`;

    const topCompanies = Object.entries(companiesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    const maxStock = topCompanies[0]?.[1] || 1;

    elements.companyChart.innerHTML = topCompanies.length
        ? topCompanies.map(([company, stock]) => {
            const percent = Math.max(8, Math.round((stock / maxStock) * 100));
            return `
                <div class="chart-row">
                    <span class="chart-label">${company}</span>
                    <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
                    <span class="chart-value">${stock.toLocaleString("pt-BR")}</span>
                </div>
            `;
        }).join("")
        : "<p>Sem dados de empresa.</p>";

    elements.lowStockBody.innerHTML = lowStockItems.length
        ? lowStockItems.map((item) => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.company}</td>
                <td>${item.stock}</td>
            </tr>
        `).join("")
        : `
            <tr>
                <td colspan="4">Nenhum item com baixo estoque.</td>
            </tr>
        `;
}

async function refreshTable() {
    state.allItems = await inventoryService.getInventory();
    renderDashboard(state.allItems);
    updateFilterOptions(state.allItems);
    const filteredItems = applyFilters(state.allItems);
    renderCurrentView(filteredItems);
}

async function openEditModal(itemId) {
    const itemToEdit = await inventoryService.repository.getById(itemId);
    if (!itemToEdit) {
        return;
    }

    state.editingItemId = itemToEdit.id;
    elements.pEditId.textContent = itemToEdit.id;
    elements.pEditName.value = itemToEdit.name;
    elements.pEditSku.value = itemToEdit.sku;
    elements.pEditStock.value = itemToEdit.stock;
    elements.modalEditOverlay.style.display = "flex";
}

function closeEditModal() {
    state.editingItemId = null;
    elements.modalEditOverlay.style.display = "none";
}

function openAddModal() {
    elements.pAddId.value = "Automatico";
    elements.pAddName.value = "";
    elements.pAddSku.value = "Automatico";
    elements.pAddCompany.value = "";
    elements.pAddStock.value = "";
    elements.modalAddOverlay.style.display = "flex";
    elements.pAddName.focus();
}

function closeAddModal() {
    elements.modalAddOverlay.style.display = "none";
}

async function saveEdit() {
    if (!state.editingItemId) {
        return;
    }

    const payload = {
        name: elements.pEditName.value,
        stock: elements.pEditStock.value,
    };

    try {
        await inventoryService.updateInventoryItem(state.editingItemId, payload);
        await refreshTable();
        closeEditModal();
        showToast("success", "Item atualizado", `O item ${state.editingItemId} foi atualizado.`);
    } catch (error) {
        showToast("error", "Erro ao atualizar", error.message);
    }
}

async function saveAddItem() {
    const payload = {
        name: elements.pAddName.value,
        company: elements.pAddCompany.value,
        stock: elements.pAddStock.value,
    };

    try {
        const createdItem = await inventoryService.createInventoryItem(payload);
        await refreshTable();
        closeAddModal();
        showToast("success", "Item adicionado", `${createdItem.name} (${createdItem.id}) foi adicionado com sucesso.`);
    } catch (error) {
        showToast("error", "Erro ao adicionar", error.message);
    }
}

async function deleteItem(itemId, itemName) {
    const confirmed = window.confirm(`Deseja excluir ${itemName}?`);
    if (!confirmed) {
        return;
    }

    try {
        await inventoryService.deleteInventoryItem(itemId);
        await refreshTable();
        showToast("success", "Item removido", `${itemName} foi removido.`);
    } catch (error) {
        showToast("error", "Erro ao remover", error.message);
    }
}

function switchTab(element) {
    const tabId = element.getAttribute("data-tab");
    if (!tabId) {
        return;
    }

    document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
    document.getElementById(tabId)?.classList.add("active");

    elements.menuItems.forEach((menuItem) => menuItem.classList.remove("inventory-active"));
    element.classList.add("inventory-active");
}

function bindEvents() {
    elements.searchInput.addEventListener("input", async (event) => {
        state.currentSearchTerm = event.target.value;
        await refreshTable();
    });
    elements.companyFilter.addEventListener("change", async (event) => {
        state.selectedCompany = event.target.value;
        await refreshTable();
    });
    elements.idFilter.addEventListener("change", async (event) => {
        state.selectedId = event.target.value;
        await refreshTable();
    });

    const handleActionClick = async (event) => {
        const actionButton = event.target.closest("button[data-action]");
        if (!actionButton) {
            return;
        }
        animateActionIcon(event.target);

        const action = actionButton.dataset.action;
        const itemId = actionButton.dataset.id;

        if (action === "edit" && itemId) {
            await openEditModal(itemId);
        }

        if (action === "delete" && itemId) {
            await deleteItem(itemId, actionButton.dataset.name || "item");
        }
    };

    elements.inventoryBody.addEventListener("click", handleActionClick);
    elements.inventoryGrid.addEventListener("click", handleActionClick);
    elements.inventoryBody.addEventListener("mouseover", (event) => {
        if (event.target.closest("button[data-action]")) {
            animateActionIcon(event.target);
        }
    });
    elements.inventoryGrid.addEventListener("mouseover", (event) => {
        if (event.target.closest("button[data-action]")) {
            animateActionIcon(event.target);
        }
    });

    elements.saveEditButton.addEventListener("click", saveEdit);
    elements.cancelEditButton.addEventListener("click", closeEditModal);
    elements.saveAddButton.addEventListener("click", saveAddItem);
    elements.cancelAddButton.addEventListener("click", closeAddModal);

    elements.modalEditOverlay.addEventListener("click", (event) => {
        if (event.target === elements.modalEditOverlay) {
            closeEditModal();
        }
    });
    elements.modalAddOverlay.addEventListener("click", (event) => {
        if (event.target === elements.modalAddOverlay) {
            closeAddModal();
        }
    });

    elements.menuItems.forEach((item) => {
        item.addEventListener("click", () => switchTab(item));
    });

    elements.addItemButton.addEventListener("click", openAddModal);
    elements.listViewButton.addEventListener("click", async () => {
        state.viewMode = "list";
        elements.listViewButton.classList.add("active");
        elements.gridViewButton.classList.remove("active");
        await refreshTable();
    });
    elements.gridViewButton.addEventListener("click", async () => {
        state.viewMode = "grid";
        elements.gridViewButton.classList.add("active");
        elements.listViewButton.classList.remove("active");
        await refreshTable();
    });
}

async function init() {
    bindEvents();
    try {
        await refreshTable();
        showToast("success", "Inventario carregado", "Dados sincronizados com sucesso.");
    } catch (error) {
        console.error(error);
        showToast("error", "Falha no carregamento", error.message);
    }

    const cfg = window.SUPABASE_CONFIG;
    const hasCfg = cfg && cfg.url && cfg.anonKey && !cfg.url.includes("YOUR_PROJECT_ID");
    if (!hasCfg) {
        alert("Supabase nao configurado. Atualize supabase-config.js para carregar dados reais.");
    }
}

init();