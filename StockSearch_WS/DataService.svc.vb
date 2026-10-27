Imports System.Data.SqlClient
Imports System.Web.Script.Serialization

'SuperStore Return Goods : the Supplier Return Qty of SuperStore (FrmSupplierReturnQty) on the portable
'Every method uses the location of the Web.config of this IIS site, the queries are the ones of the SuperStore controllers
'(SupplierReturnsController, StockItemsViews, StockUnitController, WarehousesController, SuppliersController)
Public Class DataService
    Implements IDataService

    'The quantities of tbl_SupplierReturns are NUMERIC(8, 2) (Ld_NoOfDecQty of SuperStore)
    Private Const QtyDecimals As Integer = 2

    Public Function Ping() As String Implements IDataService.Ping
        Return "Success"
    End Function

#Region "Setup"

    'The active warehouses of the location (GetWarehousesList) and the default one (Ld_DefaultWarehouse)
    'Returns {warehouses: [{code, description}], defaultWarehouse, qtyDecimals}
    Public Function GetReturnSetup(location As String) As String Implements IDataService.GetReturnSetup

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"
            If String.IsNullOrWhiteSpace(AppUserCode) Then Return "Error User Code Is Not Configured"

            Dim warehouses = GetTable(" SELECT  CONVERT(VARCHAR(2), Wh_Code) [code] ,
                                                Wh_Description [description]
                                        FROM    tbl_Warehouses
                                        WHERE   Wh_Loc = @Loc
                                                AND ISNULL(Wh_Active, 'N') = 'Y'
                                        ORDER BY Wh_Code ", P("@Loc", location))

            Dim defaultWarehouse = GetTable(" SELECT CONVERT(VARCHAR(2), Ld_DefaultWarehouse) [defaultWarehouse]
                                              FROM   tbl_LocationDirectives
                                              WHERE  Ld_Loc = @Loc ", P("@Loc", location))

            If warehouses.Rows.Count = 0 Then Return "Error No Active Warehouse For The Location " & location

            Return Serialize(New Dictionary(Of String, Object) From {
                {"warehouses", TableRows(warehouses)},
                {"defaultWarehouse", If(defaultWarehouse.Rows.Count = 0, "", defaultWarehouse.Rows(0)("defaultWarehouse").ToString)},
                {"qtyDecimals", QtyDecimals},
                {"location", location},
                {"userCode", AppUserCode}
            })

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

#End Region

#Region "Suppliers"

    'All the active suppliers (cntSuppliers search, GetSupplierQuery SimpleReadable), the device filters them, returns [{code, name}]
    Public Function GetSuppliers(location As String) As String Implements IDataService.GetSuppliers

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Return GetJson(GetTable(" SELECT Sup_Code [code] ,
                                             ISNULL(Sup_Name, '') [name]
                                      FROM   tbl_Suppliers
                                      WHERE  Sup_Loc = @Loc
                                             AND ISNULL(Sup_Active, 'N') = 'Y'
                                      ORDER BY Sup_Code ",
                                    P("@Loc", location)))

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The suppliers having returns (View), returns [{code, name, lines, totalQty, lastDate}]
    Public Function GetReturnSuppliers(location As String) As String Implements IDataService.GetReturnSuppliers

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Return GetJson(GetTable(" SELECT  Sr_Supplier [code] ,
                                              ISNULL(MAX(Sup_Name), '') [name] ,
                                              COUNT(*) [lines] ,
                                              SUM(ISNULL(Sr_QtyReturn, 0)) [totalQty] ,
                                              FORMAT(MAX(Sr_Date), 'dd/MM/yyyy') [lastDate]
                                      FROM    tbl_SupplierReturns
                                              LEFT JOIN tbl_Suppliers ON Sup_Loc = Sr_Loc AND Sup_Code = Sr_Supplier
                                      WHERE   Sr_Loc = @Loc
                                      GROUP BY Sr_Supplier
                                      ORDER BY Sr_Supplier ",
                                    P("@Loc", location)))

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The supplier (active, cntSuppliers.txtCode_Validating, any supplier for View) and its returns (GetSupplierReturnsQuery Readable)
    'Returns {supplier: {code, name}, lines: [{itemRecID, counter, itemReference, unit, description, barcode, date, basicUnit,
    '         qtyReturn, oldQtyReturn, warehouse, remarks, stock: [{warehouse, qty, display}]}]}
    Public Function GetSupplierReturns(location As String, supplierCode As String, forView As Boolean) As String Implements IDataService.GetSupplierReturns

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Dim supplier = FindSupplier(location, supplierCode, Not forView)
            If supplier Is Nothing Then Return "Error Invalid Supplier"

            Dim lines = GetTable(" SELECT  CONVERT(VARCHAR(18), Sr_StkId) [itemRecID] ,
                                           CONVERT(INT, Sr_Counter) [counter] ,
                                           CAST(Stk_Supplier AS VARCHAR(4)) + '/' + CAST(Stk_Category AS VARCHAR(3)) + '/' + CAST(Stk_Serial AS NVARCHAR(6)) [itemReference] ,
                                           Sr_StkUnit [unit] ,
                                           ISNULL(NULLIF(SUnit_SpecDesc, ''), Stk_Desc) [description] ,
                                           ISNULL(COALESCE(Stk_Barcode1, Stk_Barcode2), '') [barcode] ,
                                           FORMAT(Sr_Date, 'dd/MM/yyyy') [date] ,
                                           Stk_UnitCode [basicUnit] ,
                                           Sr_QtyReturn [qtyReturn] ,
                                           Sr_QtyReturn [oldQtyReturn] ,
                                           CONVERT(VARCHAR(2), Sr_Whouse) [warehouse] ,
                                           ISNULL(Sr_Remarks, '') [remarks]
                                   FROM    tbl_SupplierReturns
                                           INNER JOIN tbl_StockItm ON Stk_Loc = Sr_Loc AND Stk_StkId = Sr_StkId
                                           INNER JOIN tbl_StockUnit ON SUnit_Loc = Sr_Loc AND SUnit_StkId = Sr_StkId AND SUnit_Unit = Sr_StkUnit
                                   WHERE   Sr_Loc = @Loc
                                           AND Sr_Supplier = @Supplier
                                   ORDER BY Sr_Date , Sr_StkId , Sr_Counter ",
                                 P("@Loc", location), P("@Supplier", supplier("code")))

            'The stock of the items of the returns in the active warehouses, shown in the unit of the return
            Dim stock = GetTable(" SELECT  CONVERT(VARCHAR(18), Sr_StkId) [itemRecID] ,
                                           CONVERT(INT, Sr_Counter) [counter] ,
                                           CONVERT(VARCHAR(2), Wh_Code) [warehouse] ,
                                           ISNULL(Qty_AvlbQty, 0) [qty] ,
                                           ISNULL(dbo.QtyDisplay(Qty_AvlbQty, SUnit_Unit, Stk_UnitCode, ISNULL(SUnit_PackingBasic, 1)), '') [display]
                                   FROM    tbl_SupplierReturns
                                           INNER JOIN tbl_StockItm ON Stk_Loc = Sr_Loc AND Stk_StkId = Sr_StkId
                                           INNER JOIN tbl_StockUnit ON SUnit_Loc = Sr_Loc AND SUnit_StkId = Sr_StkId AND SUnit_Unit = Sr_StkUnit
                                           INNER JOIN tbl_Warehouses ON Wh_Loc = Sr_Loc AND ISNULL(Wh_Active, 'N') = 'Y'
                                           LEFT JOIN tbl_StockQty ON Qty_Loc = Sr_Loc AND Qty_Stkid = Sr_StkId AND Qty_WH = Wh_Code
                                   WHERE   Sr_Loc = @Loc
                                           AND Sr_Supplier = @Supplier
                                   ORDER BY Wh_Code ",
                                 P("@Loc", location), P("@Supplier", supplier("code")))

            Dim lineRows = TableRows(lines)

            For Each line In lineRows
                line("stock") = stock.AsEnumerable().
                    Where(Function(row) row("itemRecID").ToString = line("itemRecID").ToString AndAlso
                                        CInt(row("counter")) = CInt(line("counter"))).
                    Select(Function(row) StockRow(row)).ToList
            Next

            Return Serialize(New Dictionary(Of String, Object) From {
                {"supplier", supplier},
                {"lines", lineRows}
            })

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'Returns {code, name} of the supplier (the active ones only : activeOnly), Nothing when it is not found
    Private Function FindSupplier(location As String, supplierCode As String, Optional activeOnly As Boolean = True) As Dictionary(Of String, Object)

        Dim supplier = GetTable($" SELECT  Sup_Code [code] ,
                                           ISNULL(Sup_Name, '') [name]
                                   FROM    tbl_Suppliers
                                   WHERE   Sup_Loc = @Loc
                                           AND Sup_Code = @Code
                                           {If(activeOnly, "AND ISNULL(Sup_Active, 'N') = 'Y'", "")} ",
                                P("@Loc", location), P("@Code", If(supplierCode, "").Trim.Replace("'", "")))

        If supplier.Rows.Count = 0 Then Return Nothing
        Return TableRows(supplier)(0)

    End Function

#End Region

#Region "Items"

    'The item of a scanned / typed code (GetItemForSuppRetTrx) : reference, barcode 1 / 2, PLU, barcode synonym (its unit is the unit of the line)
    'itemRecID : the item picked when the code is used by more than one item ("" = any)
    'Returns {item: {itemRecID, itemReference, description, barcode, unit, basicUnit, packingBasic, date, stock: [{warehouse, qty, display}]}}
    '     or {matches: [{itemRecID, itemReference, description}]} when the code is used by more than one item
    Public Function FindReturnItem(location As String, code As String, itemRecID As String) As String Implements IDataService.FindReturnItem

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            code = If(code, "").Trim
            If code = "" Then Return "Error Scan Or Type The Code Of The Item"

            Dim recID As Decimal = 0
            Decimal.TryParse(If(itemRecID, "").Trim, recID)

            Dim items = GetTable($" SELECT  CONVERT(VARCHAR(18), Stk_StkId) [itemRecID] ,
                                            ISNULL(BSy_UnitCode, Stk_UnitCode) [unit] ,
                                            CAST(Stk_Supplier AS VARCHAR(4)) + '/' + CAST(Stk_Category AS VARCHAR(3)) + '/' + CAST(Stk_Serial AS NVARCHAR(6)) [itemReference] ,
                                            ISNULL(NULLIF(SUnit_SpecDesc, ''), Stk_Desc) [description] ,
                                            ISNULL(COALESCE(Bsy_Barcode, Stk_Barcode1, Stk_Barcode2), '') [barcode] ,
                                            Stk_UnitCode [basicUnit] ,
                                            ISNULL(SUnit_PackingBasic, 1) [packingBasic] ,
                                            FORMAT(GETDATE(), 'dd/MM/yyyy') [date]
                                    FROM    tbl_StockItm
                                            LEFT JOIN ( SELECT  BSy_Loc , Bsy_Stkid , BSy_UnitCode , Bsy_Barcode
                                                        FROM    tbl_BarcodeSyn
                                                        WHERE   Bsy_Barcode = @Code
                                                      ) tbl_BarcodeSyn ON tbl_BarcodeSyn.BSy_Loc = tbl_StockItm.Stk_Loc
                                                                          AND tbl_BarcodeSyn.Bsy_Stkid = tbl_StockItm.Stk_StkId
                                            LEFT JOIN tbl_StockUnit ON SUnit_Loc = Stk_Loc
                                                                       AND SUnit_StkId = Stk_StkId
                                                                       AND SUnit_Unit = ISNULL(BSy_UnitCode, Stk_UnitCode)
                                    WHERE   Stk_Loc = @Loc
                                            AND ISNULL(Stk_Status, 'I') = 'A'
                                            AND ( CAST(Stk_Supplier AS VARCHAR(4)) + '/' + CAST(Stk_Category AS VARCHAR(3)) + '/' + CAST(Stk_Serial AS NVARCHAR(6)) = @Code
                                                  OR Stk_Barcode1 = @Code
                                                  OR Stk_Barcode2 = @Code
                                                  OR CAST(Stk_PLUnbr AS VARCHAR) = @Code
                                                  OR Bsy_Barcode = @Code )
                                            {If(recID <> 0, "AND Stk_StkId = @ItemRecID", "")} ",
                                    P("@Loc", location), P("@Code", code), P("@ItemRecID", recID))

            If items.Rows.Count = 0 Then Return $"Error No Active Item Found For The Code {code}"

            Dim itemRows = TableRows(items)

            If itemRows.Select(Function(row) row("itemRecID").ToString).Distinct.Count > 1 Then
                Return Serialize(New Dictionary(Of String, Object) From {
                    {"matches", itemRows.GroupBy(Function(row) row("itemRecID").ToString).
                                         Select(Function(group) New Dictionary(Of String, Object) From {
                                             {"itemRecID", group.First()("itemRecID")},
                                             {"itemReference", group.First()("itemReference")},
                                             {"description", group.First()("description")}
                                         }).ToList}
                })
            End If

            Dim item = itemRows(0)
            item("stock") = ItemStock(location, item("itemRecID").ToString, item("unit").ToString)

            Return Serialize(New Dictionary(Of String, Object) From {{"item", item}})

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The stock search (the stock search of SuperStore, the Product Groups / Items of the portable) : all the items that can be returned
    '(active, not a service, not a 3rd party item) and their product groups (tbl_Categories), the device filters them
    'Returns {productGroups: [{code, description, items}], items: [[itemRecID, itemReference, description, barcode, productGroup]]}
    Public Function GetStockSearch(location As String) As String Implements IDataService.GetStockSearch

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Dim items = GetTable(" SELECT  CONVERT(VARCHAR(18), Stk_StkId) [itemRecID] ,
                                           CAST(Stk_Supplier AS VARCHAR(4)) + '/' + CAST(Stk_Category AS VARCHAR(3)) + '/' + CAST(Stk_Serial AS NVARCHAR(6)) [itemReference] ,
                                           ISNULL(Stk_Desc, '') [description] ,
                                           ISNULL(COALESCE(Stk_Barcode1, Stk_Barcode2), '') [barcode] ,
                                           ISNULL(Stk_Category, '') [productGroup] ,
                                           ISNULL(Stk_UnitCode, '') [basicUnit]
                                   FROM    tbl_StockItm
                                   WHERE   Stk_Loc = @Loc
                                           AND Stk_Status = 'A'
                                           AND Stk_ItmService = 'I'
                                           AND Stk_3rdParty = 'N'
                                   ORDER BY Stk_Supplier , Stk_Category , Stk_Serial ",
                                 P("@Loc", location))

            Dim productGroups = GetTable(" SELECT  ISNULL(Stk_Category, '') [code] ,
                                                   ISNULL(MAX(NULLIF(Cat_Desc, '')), ISNULL(Stk_Category, '')) [description] ,
                                                   COUNT(*) [items]
                                           FROM    tbl_StockItm
                                                   LEFT JOIN tbl_Categories ON Cat_Loc = Stk_Loc AND Cat_Code = Stk_Category
                                           WHERE   Stk_Loc = @Loc
                                                   AND Stk_Status = 'A'
                                                   AND Stk_ItmService = 'I'
                                                   AND Stk_3rdParty = 'N'
                                           GROUP BY ISNULL(Stk_Category, '')
                                           ORDER BY 2 ",
                                         P("@Loc", location))

            'The items as arrays (about 30000 items : half the size of the objects)
            Return Serialize(New Dictionary(Of String, Object) From {
                {"productGroups", TableRows(productGroups)},
                {"items", items.AsEnumerable().Select(Function(row) row.ItemArray).ToList}
            })

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The download for offline work is sent in pages (keyset paging : the device asks for the page after the last row it got)
    'so the device shows its progress, the items are the ones of GetStockSearch
    Private Const OfflineItemsCondition As String = " Stk_Loc = @Loc
                                                     AND Stk_Status = 'A'
                                                     AND Stk_ItmService = 'I'
                                                     AND Stk_3rdParty = 'N' "

    'Qty in warehouses : every active unit of every returnable item, in every active warehouse
    Private Const OfflineStockJoins As String = " FROM    tbl_StockItm
                                                         INNER JOIN tbl_StockUnit ON SUnit_Loc = Stk_Loc
                                                                                     AND SUnit_StkId = Stk_StkId
                                                                                     AND ISNULL(SUnit_Active, 'N') = 'Y'
                                                         INNER JOIN tbl_Warehouses ON Wh_Loc = Stk_Loc
                                                                                      AND ISNULL(Wh_Active, 'N') = 'Y'
                                                         LEFT JOIN tbl_StockQty ON Qty_Loc = Stk_Loc
                                                                                   AND Qty_Stkid = Stk_StkId
                                                                                   AND Qty_WH = Wh_Code "

    'The size of the download, asked first so the progress of the device has its total from the start
    'Returns {suppliers, items, stockRows, productGroups: [{code, description, items}]}
    Public Function GetOfflineCounts(location As String) As String Implements IDataService.GetOfflineCounts

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Dim counts = GetTable($" SELECT ( SELECT COUNT(*) FROM tbl_Suppliers WHERE Sup_Loc = @Loc AND ISNULL(Sup_Active, 'N') = 'Y' ) [suppliers] ,
                                            ( SELECT COUNT(*) FROM tbl_StockItm WHERE {OfflineItemsCondition} ) [items] ,
                                            ( SELECT COUNT(*) {OfflineStockJoins} WHERE {OfflineItemsCondition} ) [stockRows] ",
                                  P("@Loc", location))

            Dim productGroups = GetTable($" SELECT  ISNULL(Stk_Category, '') [code] ,
                                                    ISNULL(MAX(NULLIF(Cat_Desc, '')), ISNULL(Stk_Category, '')) [description] ,
                                                    COUNT(*) [items]
                                            FROM    tbl_StockItm
                                                    LEFT JOIN tbl_Categories ON Cat_Loc = Stk_Loc AND Cat_Code = Stk_Category
                                            WHERE   {OfflineItemsCondition}
                                            GROUP BY ISNULL(Stk_Category, '')
                                            ORDER BY 2 ",
                                          P("@Loc", location))

            Return Serialize(New Dictionary(Of String, Object) From {
                {"suppliers", counts.Rows(0)("suppliers")},
                {"items", counts.Rows(0)("items")},
                {"stockRows", counts.Rows(0)("stockRows")},
                {"productGroups", TableRows(productGroups)}
            })

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The page of the items after the item afterRecID ("" : the first page), in the order of Stk_StkId
    'Returns [[itemRecID, itemReference, description, barcode, productGroup, basicUnit]]
    Public Function GetOfflineItemsPage(location As String, afterRecID As String, pageSize As Integer) As String Implements IDataService.GetOfflineItemsPage

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Dim items = GetTable($" SELECT  TOP (@PageSize)
                                            CONVERT(VARCHAR(18), Stk_StkId) [itemRecID] ,
                                            CAST(Stk_Supplier AS VARCHAR(4)) + '/' + CAST(Stk_Category AS VARCHAR(3)) + '/' + CAST(Stk_Serial AS NVARCHAR(6)) [itemReference] ,
                                            ISNULL(Stk_Desc, '') [description] ,
                                            ISNULL(COALESCE(Stk_Barcode1, Stk_Barcode2), '') [barcode] ,
                                            ISNULL(Stk_Category, '') [productGroup] ,
                                            ISNULL(Stk_UnitCode, '') [basicUnit]
                                    FROM    tbl_StockItm
                                    WHERE   {OfflineItemsCondition}
                                            AND Stk_StkId > @AfterRecID
                                    ORDER BY Stk_StkId ",
                                  P("@Loc", location),
                                  P("@AfterRecID", ToRecID(afterRecID)),
                                  P("@PageSize", OfflinePageSize(pageSize)))

            Return Serialize(items.AsEnumerable().Select(Function(row) row.ItemArray).ToList)

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The page of the qty in warehouses after the row (afterRecID, afterUnit, afterWarehouse) (afterRecID "" : the first page),
    'in the order of Stk_StkId, SUnit_Unit, Wh_Code, the qty in the unit (QtyDisplay)
    'Returns [[itemRecID, unit, warehouse, qty, display]]
    Public Function GetOfflineStockPage(location As String, afterRecID As String, afterUnit As String, afterWarehouse As String, pageSize As Integer) As String Implements IDataService.GetOfflineStockPage

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Dim rows = GetTable($" SELECT  TOP (@PageSize)
                                           CONVERT(VARCHAR(18), Stk_StkId) [itemRecID] ,
                                           SUnit_Unit [unit] ,
                                           CONVERT(VARCHAR(2), Wh_Code) [warehouse] ,
                                           ISNULL(Qty_AvlbQty, 0) [qty] ,
                                           ISNULL(dbo.QtyDisplay(Qty_AvlbQty, SUnit_Unit, Stk_UnitCode, ISNULL(SUnit_PackingBasic, 1)), '') [display]
                                   {OfflineStockJoins}
                                   WHERE   {OfflineItemsCondition}
                                           AND Stk_StkId >= @AfterRecID
                                           AND ( Stk_StkId > @AfterRecID
                                                 OR SUnit_Unit > @AfterUnit
                                                 OR ( SUnit_Unit = @AfterUnit AND Wh_Code > @AfterWarehouse ) )
                                   ORDER BY Stk_StkId , SUnit_Unit , Wh_Code ",
                                 P("@Loc", location),
                                 P("@AfterRecID", ToRecID(afterRecID)),
                                 P("@AfterUnit", If(afterUnit, "")),
                                 P("@AfterWarehouse", If(String.IsNullOrWhiteSpace(afterWarehouse), -1D, ToRecID(afterWarehouse))),
                                 P("@PageSize", OfflinePageSize(pageSize)))

            Return Serialize(rows.AsEnumerable().Select(Function(row) row.ItemArray).ToList)

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The rows of a page of the offline download : 5000 when not given, 20000 at most
    Private Function OfflinePageSize(requested As Integer) As Integer
        If requested <= 0 Then Return 5000
        Return Math.Min(requested, 20000)
    End Function

    'The active units of the item (GetStockUnitDataTable SimpleReadable), returns [{code, description}]
    Public Function GetItemUnits(location As String, itemRecID As String) As String Implements IDataService.GetItemUnits

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            Return GetJson(GetTable(" SELECT  SUnit_Unit [code] ,
                                              ISNULL(NULLIF(SUnit_SpecDesc, ''), Stk_Desc) [description]
                                      FROM    tbl_StockUnit
                                              INNER JOIN tbl_StockItm ON Stk_Loc = SUnit_Loc AND Stk_StkId = SUnit_StkId
                                      WHERE   SUnit_Loc = @Loc
                                              AND SUnit_StkId = @ItemRecID
                                              AND ISNULL(SUnit_Active, 'N') = 'Y'
                                      ORDER BY CASE WHEN SUnit_ParentUnit = SUnit_Unit THEN 0 ELSE SUnit_PackingBasic END ",
                                    P("@Loc", location), P("@ItemRecID", ToRecID(itemRecID))))

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'A unit typed / picked for the item (GetStockUnit) : its first barcode synonym and the stock shown in this unit
    'Returns {unit, barcode, stock: [{warehouse, qty, display}]}, barcode = "" when the unit has no barcode synonym
    Public Function GetItemUnit(location As String, itemRecID As String, unit As String) As String Implements IDataService.GetItemUnit

        Try

            location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"

            unit = If(unit, "").Trim.ToUpper

            Dim units = GetTable(" SELECT  SUnit_Unit [unit] ,
                                           ISNULL(( SELECT TOP 1 Bsy_Barcode
                                                    FROM   tbl_BarcodeSyn
                                                    WHERE  BSy_Loc = SUnit_Loc
                                                           AND Bsy_Stkid = SUnit_StkId
                                                           AND BSy_UnitCode = SUnit_Unit ), '') [barcode]
                                   FROM    tbl_StockUnit
                                   WHERE   SUnit_Loc = @Loc
                                           AND SUnit_StkId = @ItemRecID
                                           AND SUnit_Unit = @Unit ",
                                 P("@Loc", location), P("@ItemRecID", ToRecID(itemRecID)), P("@Unit", unit))

            If units.Rows.Count = 0 Then Return "Error Invalid Unit"

            Dim result = TableRows(units)(0)
            result("stock") = ItemStock(location, itemRecID, unit)

            Return Serialize(result)

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The stock of the item in the active warehouses, shown in the unit (QtyDisplay), returns [{warehouse, qty, display}]
    Private Function ItemStock(location As String, itemRecID As String, unit As String) As List(Of Dictionary(Of String, Object))

        Dim stock = GetTable(" SELECT  CONVERT(VARCHAR(2), Wh_Code) [warehouse] ,
                                       ISNULL(Qty_AvlbQty, 0) [qty] ,
                                       ISNULL(dbo.QtyDisplay(Qty_AvlbQty, @Unit, Stk_UnitCode, ISNULL(SUnit_PackingBasic, 1)), '') [display]
                               FROM    tbl_Warehouses
                                       INNER JOIN tbl_StockItm ON Stk_Loc = Wh_Loc AND Stk_StkId = @ItemRecID
                                       LEFT JOIN tbl_StockUnit ON SUnit_Loc = Stk_Loc AND SUnit_StkId = Stk_StkId AND SUnit_Unit = @Unit
                                       LEFT JOIN tbl_StockQty ON Qty_Loc = Stk_Loc AND Qty_Stkid = Stk_StkId AND Qty_WH = Wh_Code
                               WHERE   Wh_Loc = @Loc
                                       AND ISNULL(Wh_Active, 'N') = 'Y'
                               ORDER BY Wh_Code ",
                             P("@Loc", location), P("@ItemRecID", ToRecID(itemRecID)), P("@Unit", unit))

        Return stock.AsEnumerable().Select(Function(row) StockRow(row)).ToList

    End Function

    Private Function StockRow(row As DataRow) As Dictionary(Of String, Object)
        Return New Dictionary(Of String, Object) From {
            {"warehouse", row("warehouse")},
            {"qty", row("qty")},
            {"display", row("display")}
        }
    End Function

#End Region

#Region "Save"

    Private Class ReturnLine
        'The supplier of the line : the upload of the returns saved on a device (CommitReturnUpload) only
        Public supplierCode As String
        Public itemRecID As String
        Public counter As Integer
        Public unit As String
        Public qtyReturn As Decimal
        Public oldQtyReturn As Decimal
        Public warehouse As String
        Public remarks As String
        Public state As String
    End Class

    'Saves the returns of the supplier (SupplierReturnsController) in one transaction, with the stock (StockQtyTrx.UpdateStockQty) :
    'saveMode A : new lines (BulkInsertSupplierReturns), the counter of each line follows the last one of the item
    '         M : changed quantities / remarks (state M) and deleted lines (state D) of the supplier (BulkUpdateSupplierReturns)
    '         D : all the returns of the supplier (DeleteSupplierReturns)
    'lines : [{itemRecID, counter, unit, qtyReturn, oldQtyReturn, warehouse, remarks, state}]
    Public Function SaveSupplierReturns(location As String, userCode As String, supplierCode As String, saveMode As String, lines As String) As String Implements IDataService.SaveSupplierReturns

        Try
            Return SaveReturnLines(supplierCode, saveMode, ParseReturnLines(lines))
        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    Private Function ParseReturnLines(lines As String) As List(Of ReturnLine)
        Dim linesSerializer As New JavaScriptSerializer() With {.MaxJsonLength = 536870912}
        Return linesSerializer.Deserialize(Of List(Of ReturnLine))(If(lines, "[]"))
    End Function

    'The save of SaveSupplierReturns and CommitReturnUpload : all the lines in one transaction
    Private Function SaveReturnLines(supplierCode As String, saveMode As String, returnLines As List(Of ReturnLine)) As String
        Return SaveReturnLines(saveMode, New List(Of KeyValuePair(Of String, List(Of ReturnLine))) From {
            New KeyValuePair(Of String, List(Of ReturnLine))(supplierCode, returnLines)
        })
    End Function

    'The returns of several suppliers (supplierReturns : supplier code -> its lines) in one transaction : all of them or none
    Private Function SaveReturnLines(saveMode As String, supplierReturns As List(Of KeyValuePair(Of String, List(Of ReturnLine)))) As String

        Try

            Dim location = AppLocation
            If String.IsNullOrWhiteSpace(location) Then Return "Error Location Is Not Configured"
            Dim userCode = AppUserCode
            If String.IsNullOrWhiteSpace(userCode) Then Return "Error User Code Is Not Configured"

            saveMode = If(saveMode, "").Trim.ToUpper
            If saveMode <> "A" AndAlso saveMode <> "M" AndAlso saveMode <> "D" Then Return "Error Invalid Save Mode"

            'Everything is checked before anything is saved
            Dim checkedReturns As New List(Of KeyValuePair(Of String, List(Of ReturnLine)))
            For Each supplierReturn In supplierReturns

                Dim supplier = FindSupplier(location, supplierReturn.Key)
                If supplier Is Nothing Then Return $"Error Invalid Supplier {supplierReturn.Key}"
                Dim returnLines = supplierReturn.Value

                If saveMode = "A" AndAlso returnLines.Count = 0 Then Return "Error No Records To Save"

                If saveMode <> "D" Then
                    For Each line In returnLines
                        If line.state <> "D" AndAlso line.qtyReturn <= 0 Then Return "Error Quantity To Return Must Be Greater Than 0"
                        If String.IsNullOrWhiteSpace(line.unit) OrElse String.IsNullOrWhiteSpace(line.warehouse) Then Return "Error Exist Invalid Records"
                    Next
                End If

                checkedReturns.Add(New KeyValuePair(Of String, List(Of ReturnLine))(supplier("code").ToString, returnLines))

            Next

            If checkedReturns.Count = 0 Then Return "Error No Records To Save"

            Using cnSQL As New SqlConnection(AppConnectionString)

                cnSQL.Open()

                Using trnSQL = cnSQL.BeginTransaction()

                    Using cmSQL = cnSQL.CreateCommand()

                        cmSQL.Transaction = trnSQL
                        cmSQL.CommandTimeout = 600

                        Try

                            For Each supplierReturn In checkedReturns

                                Dim supplierCode = supplierReturn.Key
                                Dim returnLines = supplierReturn.Value

                                If saveMode = "D" Then
                                    DeleteSupplierReturns(cmSQL, location, supplierCode, "")
                                Else

                                    CreateTempReturns(cmSQL, trnSQL, location, supplierCode, saveMode, returnLines)

                                    If saveMode = "A" Then
                                        InsertSupplierReturns(cmSQL, location, supplierCode, userCode)
                                        UpdateStockQty(cmSQL, location, userCode)
                                    Else
                                        UpdateSupplierReturns(cmSQL, location, supplierCode)
                                        UpdateStockQty(cmSQL, location, userCode)
                                        DeleteSupplierReturns(cmSQL, location, supplierCode, " JOIN #TempReturns ON Sr_Supplier = @Supplier
                                                                                                           AND Sr_Loc = @Loc
                                                                                                           AND Sr_StkId = ItemRecID
                                                                                                           AND Sr_Counter = [Counter]
                                                                                                           AND [State] = 'D' ")
                                    End If

                                    'The next supplier creates it again
                                    cmSQL.Parameters.Clear()
                                    cmSQL.CommandText = " DROP TABLE #TempReturns; "
                                    cmSQL.ExecuteNonQuery()

                                End If

                            Next

                            trnSQL.Commit()

                        Catch
                            Try
                                trnSQL.Rollback()
                            Catch
                            End Try
                            Throw
                        End Try

                    End Using

                End Using

            End Using

            Return "Success"

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The upload of the returns saved on a device (all of them, of every supplier) : all the lines or none
    'The device sends the pages (UploadReturnPage), they are kept in the temp folder of the server, then CommitReturnUpload
    'saves all of them in one transaction (SaveReturnLines). uploadId is the same for every try of the same returns :
    'an upload that stops is sent again from the start, a commit already done answers Success without saving twice
    Private Shared ReadOnly UploadLock As New Object
    Private Const UploadDoneFile As String = "committed.txt"
    Private Const UploadKeepDays As Integer = 7

    Private Function UploadFolder(uploadId As String) As String
        Using sha = System.Security.Cryptography.SHA1.Create()
            Dim hash = BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(uploadId))).Replace("-", "")
            Return System.IO.Path.Combine(UploadsRoot(), hash)
        End Using
    End Function

    Private Function UploadsRoot() As String
        Return System.IO.Path.Combine(System.IO.Path.GetTempPath(), "SuperStoreReturnGoods_Uploads")
    End Function

    Private Function UploadPageFile(folder As String, pageIndex As Integer) As String
        Return System.IO.Path.Combine(folder, $"page_{pageIndex:D5}.json")
    End Function

    'The uploads older than UploadKeepDays (done or stopped)
    Private Sub CleanOldUploads()
        Try
            If Not System.IO.Directory.Exists(UploadsRoot()) Then Return
            For Each folder In System.IO.Directory.GetDirectories(UploadsRoot())
                If System.IO.Directory.GetLastWriteTime(folder) < DateTime.Now.AddDays(-UploadKeepDays) Then
                    System.IO.Directory.Delete(folder, True)
                End If
            Next
        Catch
        End Try
    End Sub

    'pageIndex 0 starts the upload again (the pages of a try that stopped are removed)
    Public Function UploadReturnPage(location As String, uploadId As String, pageIndex As Integer, lines As String) As String Implements IDataService.UploadReturnPage

        Try

            If String.IsNullOrWhiteSpace(uploadId) Then Return "Error Invalid Upload"
            If pageIndex < 0 Then Return "Error Invalid Upload Page"

            'The lines must be valid now : an invalid page fails here, not at the commit
            ParseReturnLines(lines)

            SyncLock UploadLock

                Dim folder = UploadFolder(uploadId)
                If System.IO.File.Exists(System.IO.Path.Combine(folder, UploadDoneFile)) Then Return "Success"

                If pageIndex = 0 Then
                    CleanOldUploads()
                    If System.IO.Directory.Exists(folder) Then System.IO.Directory.Delete(folder, True)
                End If

                System.IO.Directory.CreateDirectory(folder)
                System.IO.File.WriteAllText(UploadPageFile(folder, pageIndex), If(lines, "[]"), System.Text.Encoding.UTF8)

            End SyncLock

            Return "Success"

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The upload is cancelled on the device (or failed) before the commit : its pages are removed, nothing is saved
    Public Function CancelReturnUpload(location As String, uploadId As String) As String Implements IDataService.CancelReturnUpload

        Try

            If String.IsNullOrWhiteSpace(uploadId) Then Return "Error Invalid Upload"

            SyncLock UploadLock
                Dim folder = UploadFolder(uploadId)
                If System.IO.Directory.Exists(folder) AndAlso Not System.IO.File.Exists(System.IO.Path.Combine(folder, UploadDoneFile)) Then
                    System.IO.Directory.Delete(folder, True)
                End If
            End SyncLock

            Return "Success"

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'Saves the pageCount pages of the upload (lineCount lines in all, each with its supplierCode) in one transaction
    Public Function CommitReturnUpload(location As String, uploadId As String, pageCount As Integer, lineCount As Integer) As String Implements IDataService.CommitReturnUpload

        Try

            If String.IsNullOrWhiteSpace(uploadId) Then Return "Error Invalid Upload"

            SyncLock UploadLock

                Dim folder = UploadFolder(uploadId)
                If System.IO.File.Exists(System.IO.Path.Combine(folder, UploadDoneFile)) Then Return "Success"

                Dim returnLines As New List(Of ReturnLine)
                For pageIndex = 0 To pageCount - 1
                    Dim pageFile = UploadPageFile(folder, pageIndex)
                    If Not System.IO.File.Exists(pageFile) Then Return "Error The Upload Is Incomplete, Please Upload Again"
                    returnLines.AddRange(ParseReturnLines(System.IO.File.ReadAllText(pageFile, System.Text.Encoding.UTF8)))
                Next

                If pageCount <= 0 OrElse returnLines.Count <> lineCount Then Return "Error The Upload Is Incomplete, Please Upload Again"

                'The lines of each supplier, in the order of the device
                Dim supplierReturns = returnLines.GroupBy(Function(line) If(line.supplierCode, "").Trim) _
                                                 .Select(Function(group) New KeyValuePair(Of String, List(Of ReturnLine))(group.Key, group.ToList)) _
                                                 .ToList
                Dim result = SaveReturnLines("A", supplierReturns)
                If result <> "Success" Then Return result

                'Saved : the pages are not needed anymore, the marker answers the tries of the same upload
                For Each pageFile In System.IO.Directory.GetFiles(folder, "page_*.json")
                    System.IO.File.Delete(pageFile)
                Next
                System.IO.File.WriteAllText(System.IO.Path.Combine(folder, UploadDoneFile), DateTime.Now.ToString("s"))

                Return "Success"

            End SyncLock

        Catch ex As Exception
            Return ErrorResult(ex)
        End Try

    End Function

    'The lines to save (CreateTempTable / BulkInsertToTempDetails), a temp table of the connection : the devices share the same user
    Private Sub CreateTempReturns(cmSQL As SqlCommand, trnSQL As SqlTransaction, location As String, supplierCode As String, saveMode As String, returnLines As List(Of ReturnLine))

        cmSQL.Parameters.Clear()
        cmSQL.CommandText = " CREATE TABLE #TempReturns (
                                    [Loc] VARCHAR(2),
                                    [Supplier] VARCHAR(4),
                                    [ItemRecID] NUMERIC(18, 0),
                                    [Unit] VARCHAR(3),
                                    [QtyReturn] NUMERIC(8, 2),
                                    [OldQtyReturn] NUMERIC(8, 2),
                                    [WhouseNb] NUMERIC(2, 0),
                                    [Remarks] NVARCHAR(500),
                                    [Counter] NUMERIC(18, 0),
                                    [State] VARCHAR(1)); "
        cmSQL.ExecuteNonQuery()

        Using dtReturns As New DataTable

            dtReturns.Columns.Add("Loc", GetType(String))
            dtReturns.Columns.Add("Supplier", GetType(String))
            dtReturns.Columns.Add("ItemRecID", GetType(Decimal))
            dtReturns.Columns.Add("Unit", GetType(String))
            dtReturns.Columns.Add("QtyReturn", GetType(Decimal))
            dtReturns.Columns.Add("OldQtyReturn", GetType(Decimal))
            dtReturns.Columns.Add("WhouseNb", GetType(Decimal))
            dtReturns.Columns.Add("Remarks", GetType(String))
            dtReturns.Columns.Add("Counter", GetType(Decimal))
            dtReturns.Columns.Add("State", GetType(String))

            For Each line In returnLines
                dtReturns.Rows.Add(location,
                                   supplierCode,
                                   ToRecID(line.itemRecID),
                                   If(line.unit, "").Trim.ToUpper,
                                   Math.Round(line.qtyReturn, QtyDecimals),
                                   Math.Round(line.oldQtyReturn, QtyDecimals),
                                   ToRecID(line.warehouse),
                                   If(String.IsNullOrWhiteSpace(line.remarks), "", line.remarks.Trim),
                                   line.counter,
                                   If(saveMode = "A", "A", If(line.state, "").Trim.ToUpper))
            Next

            Using bulkCopy As New SqlBulkCopy(cmSQL.Connection, SqlBulkCopyOptions.Default, trnSQL)
                bulkCopy.DestinationTableName = "#TempReturns"
                For Each column As DataColumn In dtReturns.Columns
                    bulkCopy.ColumnMappings.Add(column.ColumnName, column.ColumnName)
                Next
                bulkCopy.WriteToServer(dtReturns)
            End Using

        End Using

    End Sub

    Private Sub InsertSupplierReturns(cmSQL As SqlCommand, location As String, supplierCode As String, userCode As String)

        cmSQL.CommandText = " INSERT INTO tbl_SupplierReturns
                                     ( Sr_Loc , Sr_Supplier , Sr_StkId , Sr_Counter , Sr_Date , Sr_QtyReturn , Sr_Whouse , Sr_Remarks , Sr_ContrRef , Sr_Ustmp , Sr_Dstmp , Sr_StkUnit )
                              SELECT  @Loc ,
                                      @Supplier ,
                                      tr.ItemRecID ,
                                      ROW_NUMBER() OVER ( ORDER BY tr.Loc , tr.Supplier , tr.ItemRecID ) + ( SELECT COALESCE(MAX(Sr_Counter), 0)
                                                                                                            FROM   tbl_SupplierReturns sTb
                                                                                                            WHERE  sTb.Sr_Loc = tr.Loc
                                                                                                                   AND sTb.Sr_Supplier = tr.Supplier
                                                                                                                   AND sTb.Sr_StkId = tr.ItemRecID ) ,
                                      @Date ,
                                      tr.QtyReturn ,
                                      tr.WhouseNb ,
                                      NULLIF(tr.Remarks, '') ,
                                      NULL ,
                                      @UserCode ,
                                      GETDATE() ,
                                      tr.Unit
                              FROM    #TempReturns tr; "

        cmSQL.Parameters.Clear()
        cmSQL.Parameters.AddWithValue("@Loc", location)
        cmSQL.Parameters.AddWithValue("@Supplier", supplierCode)
        cmSQL.Parameters.AddWithValue("@Date", DateTime.Now.Date)
        cmSQL.Parameters.AddWithValue("@UserCode", userCode)
        cmSQL.ExecuteNonQuery()

    End Sub

    Private Sub UpdateSupplierReturns(cmSQL As SqlCommand, location As String, supplierCode As String)

        cmSQL.CommandText = " UPDATE  tbl_SupplierReturns
                              SET     Sr_QtyReturn = t.QtyReturn ,
                                      Sr_Remarks = NULLIF(t.Remarks, '')
                              FROM    tbl_SupplierReturns
                                      INNER JOIN #TempReturns t ON Sr_Supplier = @Supplier
                                                                   AND Sr_Loc = @Loc
                                                                   AND Sr_StkId = t.ItemRecID
                                                                   AND Sr_Counter = t.Counter; "

        cmSQL.Parameters.Clear()
        cmSQL.Parameters.AddWithValue("@Loc", location)
        cmSQL.Parameters.AddWithValue("@Supplier", supplierCode)
        cmSQL.ExecuteNonQuery()

    End Sub

    'joinCondition "" : all the returns of the supplier
    Private Sub DeleteSupplierReturns(cmSQL As SqlCommand, location As String, supplierCode As String, joinCondition As String)

        cmSQL.CommandText = $" DELETE  tbl_SupplierReturns
                               FROM    tbl_SupplierReturns
                               {If(joinCondition = "", "WHERE Sr_Loc = @Loc AND Sr_Supplier = @Supplier", joinCondition)} "

        cmSQL.Parameters.Clear()
        cmSQL.Parameters.AddWithValue("@Loc", location)
        cmSQL.Parameters.AddWithValue("@Supplier", supplierCode)
        cmSQL.ExecuteNonQuery()

    End Sub

    'StockQtyTrx.UpdateStockQty for the returns : the returned quantity (in the basic unit) of the item (Stk_Return1) and of its warehouse (Qty_Return)
    'A : + the quantity, M : - (old quantity - quantity), D : - the quantity
    Private Sub UpdateStockQty(cmSQL As SqlCommand, location As String, userCode As String)

        cmSQL.CommandText = " DECLARE @TempStockQtyChanges TABLE
                                  ( LocationCode VARCHAR(2) ,
                                    WarehouseCode NUMERIC(2, 0) ,
                                    ItemRecID NUMERIC(18, 0) ,
                                    QtyReturn NUMERIC(18, 2) );

                              INSERT  INTO @TempStockQtyChanges
                                      SELECT  @Loc LocationCode ,
                                              WhouseNb WarehouseCode ,
                                              ItemRecID ,
                                              CASE WHEN [State] = 'D' THEN -( ISNULL(QtyReturn, 0) )
                                                   WHEN [State] = 'M' THEN -( ISNULL(OldQtyReturn, 0) - ISNULL(QtyReturn, 0) )
                                                   WHEN [State] = 'A' THEN ISNULL(QtyReturn, 0)
                                                   ELSE 0
                                              END * SUnit_PackingBasic QtyReturn
                                      FROM    #TempReturns TempDetails
                                              INNER JOIN ( SELECT SUnit_StkId , SUnit_Unit , SUnit_PackingBasic
                                                           FROM   tbl_StockUnit
                                                           WHERE  SUnit_Loc = @Loc
                                                         ) tbl_StockUnit ON SUnit_StkId = ItemRecID
                                                                            AND SUnit_Unit = Unit;

                              UPDATE  tbl_StockItm
                              SET     Stk_Return1 = ISNULL(Stk_Return1, 0) + ISNULL(SumQtyReturn, 0)
                              FROM    tbl_StockItm
                                      INNER JOIN ( SELECT LocationCode , ItemRecID , SUM(ISNULL(QtyReturn, 0)) SumQtyReturn
                                                   FROM   @TempStockQtyChanges
                                                   GROUP BY LocationCode , ItemRecID
                                                 ) tblChanges ON LocationCode = Stk_Loc
                                                                 AND ItemRecID = Stk_StkId
                              WHERE   Stk_Loc = @Loc;

                              INSERT  INTO tbl_StockQty
                                      ( Qty_Loc , Qty_Stkid , Qty_WH , Qty_Min , Qty_Max , Qty_BBF , Qty_AvlbQty , Qty_Return , Qty_DStmp , Qty_UStmp )
                                      SELECT  @Loc , ItemRecID , WarehouseCode , 0 , 0 , 0 , 0 , 0 , GETDATE() , @UserCode
                                      FROM    ( SELECT DISTINCT ItemRecID , WarehouseCode
                                                FROM   @TempStockQtyChanges ) TempStockQtyChanges
                                      WHERE   NOT EXISTS ( SELECT TOP 1 1
                                                           FROM   tbl_StockQty
                                                           WHERE  Qty_Loc = @Loc
                                                                  AND Qty_Stkid = ItemRecID
                                                                  AND Qty_WH = WarehouseCode );

                              UPDATE  tbl_StockQty
                              SET     Qty_Return = ISNULL(Qty_Return, 0) + ISNULL(SumQtyReturn, 0)
                              FROM    tbl_StockQty
                                      INNER JOIN ( SELECT LocationCode , ItemRecID , WarehouseCode , SUM(ISNULL(QtyReturn, 0)) SumQtyReturn
                                                   FROM   @TempStockQtyChanges
                                                   GROUP BY LocationCode , ItemRecID , WarehouseCode
                                                 ) tblChanges ON LocationCode = Qty_Loc
                                                                 AND ItemRecID = Qty_Stkid
                                                                 AND WarehouseCode = Qty_WH
                              WHERE   Qty_Loc = @Loc; "

        cmSQL.Parameters.Clear()
        cmSQL.Parameters.AddWithValue("@Loc", location)
        cmSQL.Parameters.AddWithValue("@UserCode", userCode)
        cmSQL.ExecuteNonQuery()

    End Sub

#End Region

#Region "Data"

    'The error sent to the device : the database cannot be reached (login, server, network), else the message of the error
    Private Function ErrorResult(ex As Exception) As String

        Dim sqlError = TryCast(ex, SqlException)

        If sqlError IsNot Nothing AndAlso {-2, -1, 2, 53, 4060, 18456, 10060, 10061}.Contains(sqlError.Number) Then
            Return "Error Cannot Connect To The SuperStore Database, Please Try Again Or Call The IT"
        End If

        Return "Error " & ex.Message

    End Function

    Private Function GetTable(strsql As String, ParamArray parameters() As SqlParameter) As DataTable

        Dim dtData As New DataTable

        Using daSql As New SqlDataAdapter(strsql, AppConnectionString)
            daSql.SelectCommand.CommandTimeout = 600
            daSql.SelectCommand.Parameters.AddRange(parameters)
            daSql.Fill(dtData)
        End Using

        Return dtData

    End Function

    Private Function P(name As String, value As Object) As SqlParameter
        Return New SqlParameter(name, If(value, ""))
    End Function

    Private Function ToRecID(value As String) As Decimal
        Dim recID As Decimal = 0
        Decimal.TryParse(If(value, "").Trim, recID)
        Return recID
    End Function

    Private Function TableRows(_DataTable As DataTable) As List(Of Dictionary(Of String, Object))

        Dim rows As New List(Of Dictionary(Of String, Object))

        For Each dr As DataRow In _DataTable.Rows
            Dim row As New Dictionary(Of String, Object)
            For Each col As DataColumn In _DataTable.Columns
                row.Add(col.ColumnName, If(IsDBNull(dr(col)), Nothing, dr(col)))
            Next
            rows.Add(row)
        Next

        Return rows

    End Function

    Private Function Serialize(value As Object) As String
        Dim serializer As New JavaScriptSerializer()
        serializer.MaxJsonLength = 536870912
        Return serializer.Serialize(value)
    End Function

    Public Function GetJson(ByRef _DataTable As DataTable) As String
        Return Serialize(TableRows(_DataTable))
    End Function

#End Region

End Class
