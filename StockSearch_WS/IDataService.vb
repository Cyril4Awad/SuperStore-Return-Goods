' NOTE: You can use the "Rename" command on the context menu to change the interface name "IService1" in both code and config file together.
<ServiceContract()>
Public Interface IDataService

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function Ping() As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetReturnSetup(location As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetSuppliers(location As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetReturnSuppliers(location As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetSupplierReturns(location As String, supplierCode As String, forView As Boolean) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function FindReturnItem(location As String, code As String, itemRecID As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetStockSearch(location As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetOfflineCounts(location As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetOfflineItemsPage(location As String, afterRecID As String, pageSize As Integer) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetOfflineStockPage(location As String, afterRecID As String, afterUnit As String, afterWarehouse As String, pageSize As Integer) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetItemUnits(location As String, itemRecID As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function GetItemUnit(location As String, itemRecID As String, unit As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function SaveSupplierReturns(location As String, userCode As String, supplierCode As String, saveMode As String, lines As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function UploadReturnPage(location As String, uploadId As String, pageIndex As Integer, lines As String) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function CommitReturnUpload(location As String, uploadId As String, pageCount As Integer, lineCount As Integer) As String

    <OperationContract>
    <FaultContract(GetType(String))>
    <WebInvoke(Method:="POST", BodyStyle:=WebMessageBodyStyle.Wrapped, ResponseFormat:=WebMessageFormat.Json)>
    Function CancelReturnUpload(location As String, uploadId As String) As String

End Interface
