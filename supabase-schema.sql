create sequence if not exists public.inventory_id_seq start with 1745 increment by 1;
create sequence if not exists public.inventory_sku_seq start with 12569760 increment by 1;

create table if not exists public.inventory_items (
    id text primary key,
    name text not null,
    sku text not null unique,
    company text not null,
    stock integer not null default 0 check (stock >= 0),
    last_mod timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create or replace function public.set_inventory_codes()
returns trigger
language plpgsql
as $$
begin
    if new.id is null or btrim(new.id) = '' then
        new.id := nextval('public.inventory_id_seq')::text || 'D';
    end if;

    if new.sku is null or btrim(new.sku) = '' then
        new.sku := nextval('public.inventory_sku_seq')::text;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_set_inventory_codes on public.inventory_items;
create trigger trg_set_inventory_codes
before insert on public.inventory_items
for each row
execute function public.set_inventory_codes();

alter table public.inventory_items enable row level security;

drop policy if exists "inventory read all" on public.inventory_items;
create policy "inventory read all"
on public.inventory_items
for select
to anon, authenticated
using (true);

drop policy if exists "inventory write all" on public.inventory_items;
create policy "inventory write all"
on public.inventory_items
for all
to anon, authenticated
using (true)
with check (true);

insert into public.inventory_items (id, name, sku, company, stock, last_mod)
values
    ('1741D', 'Camiseta', '12569756', 'Veritas', 1108, now()),
    ('1742D', 'Camisa Longa', '12569757', 'System', 500, now()),
    ('1743D', 'Calca Social', '12569758', 'Fides', 240, now()),
    ('1744D', 'Bota PVC', '12569759', 'SP Serv', 85, now())
on conflict (id) do nothing;

select setval(
    'public.inventory_id_seq',
    greatest(
        1745,
        coalesce((select max((regexp_replace(id, '\D', '', 'g'))::bigint) from public.inventory_items), 1745)
    ),
    true
);

select setval(
    'public.inventory_sku_seq',
    greatest(
        12569760,
        coalesce((select max(sku::bigint) from public.inventory_items where sku ~ '^[0-9]+$'), 12569760)
    ),
    true
);
