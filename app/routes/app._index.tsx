import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

type Order = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalOutstandingSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
};

export default function Index() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "shopify:admin/api/2026-10/graphql.json",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `query PayLinkTestOrders {
              shop {
                name
                myshopifyDomain
              }
              currentAppInstallation {
                accessScopes { handle }
              }
              orders(
                first: 10,
                query: "status:any",
                sortKey: CREATED_AT,
                reverse: true
              ) {
                edges {
                  node {
                    id
                    name
                    createdAt
                    displayFinancialStatus
                    totalPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                    totalOutstandingSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }`,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (result.errors?.length) {
        throw new Error(
          result.errors.map((e: { message: string }) => e.message).join("; "),
        );
      }

      if (!result.data?.orders) {
        throw new Error("لم تصل بيانات الطلبات من Shopify.");
      }

      setGrantedScopes(
        result.data.currentAppInstallation?.accessScopes?.map(
          (scope: { handle: string }) => scope.handle,
        ) ?? [],
      );
      setDiagnostics(JSON.stringify({
        shop: result.data.shop,
        hasOrdersData: Boolean(result.data.orders),
        returnedOrders: result.data.orders.edges.length,
        grantedScopes: result.data.currentAppInstallation?.accessScopes?.map(
          (scope: { handle: string }) => scope.handle,
        ) ?? [],
      }, null, 2));
      setOrders(
        result.data.orders.edges.map(
          (edge: { node: Order }) => edge.node,
        ),
      );
      setLoaded(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "حدث خطأ غير معروف.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <s-page heading="PayLink — اختبار الطلبات">
      <s-section heading="الاتصال بمتجر Shopify">
        <s-paragraph>
          الاختبار يقرأ أحدث 10 طلبات من Shopify مباشرةً من واجهة التطبيق.
          لا يتم تحديث حالة الدفع في هذه المرحلة.
        </s-paragraph>

        <s-button
          onClick={loadOrders}
          {...(loading ? { loading: true } : {})}
        >
          {loading ? "جارٍ تحميل الطلبات..." : "تحميل أحدث 10 طلبات"}
        </s-button>

        {error && (
          <s-banner tone="critical">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        )}

        {loaded && !error && (
          <s-section heading="تشخيص الاتصال والصلاحيات">
            <s-paragraph>عدد الطلبات المستلمة: {orders.length}</s-paragraph>
            <s-paragraph>الصلاحيات الممنوحة: {grantedScopes.join(", ") || "لم تظهر أي صلاحيات"}</s-paragraph>
            <s-paragraph>{diagnostics}</s-paragraph>
          </s-section>
        )}
      </s-section>

      {orders.map((order) => (
        <s-section key={order.id} heading={order.name}>
          <s-paragraph>
            الحالة المالية: {order.displayFinancialStatus}
          </s-paragraph>
          <s-paragraph>
            الإجمالي: {order.totalPriceSet.shopMoney.amount}{" "}
            {order.totalPriceSet.shopMoney.currencyCode}
          </s-paragraph>
          <s-paragraph>
            المبلغ المستحق: {order.totalOutstandingSet.shopMoney.amount}{" "}
            {order.totalOutstandingSet.shopMoney.currencyCode}
          </s-paragraph>
          <s-paragraph>
            تاريخ الإنشاء: {order.createdAt}
          </s-paragraph>
        </s-section>
      ))}
    </s-page>
  );
}
